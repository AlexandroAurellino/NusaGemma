# app/main.py

import json
import time
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

# Import internals
from app.models.schemas import ChatRequest, ChatResponse, ToggleRequest
from app.services.llm_engine import llm_service
from app.services.rag_engine import rag_service

app = FastAPI(title="NusaGemma API", version="2.0")

# CORS (Frontend Access)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    status = "online" if llm_service.llm else "offline"
    return {"system": "NusaGemma", "status": status, "version": "2.0"}

# --- DOCS ---
@app.get("/documents")
def list_docs():
    return rag_service.registry

@app.post("/documents/upload")
def upload_doc(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Only PDFs allowed")
    
    success, msg = rag_service.upload_pdf(file.file, file.filename)
    return {"success": success, "message": msg}

@app.post("/documents/toggle")
def toggle_doc(req: ToggleRequest):
    success = rag_service.toggle(req.filename, req.enabled)
    return {"success": success}

# --- CHAT ---
@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    start_time = time.time()
    
    context_text = ""
    sources = []

    # 1. RAG Retrieval
    if req.use_rag:
        retriever = rag_service.get_retriever()
        if retriever:
            try:
                docs = retriever.invoke(req.message)
                context_text = "\n\n".join([d.page_content for d in docs])
                sources = list(set([d.metadata.get("source", "Unknown") for d in docs]))
            except Exception as e:
                print(f"RAG Error: {e}")

    # 2. Prompt Engineering
    if context_text:
        prompt = (
            f"Context from Guidelines:\n{context_text}\n\n"
            f"User Question: {req.message}\n\n"
            f"Instruction: Answer based STRICTLY on the context provided."
        )
    else:
        prompt = req.message

    # 3. Generate
    response_text = llm_service.generate(prompt)
    
    return {
        "response": response_text,
        "used_rag": bool(context_text),
        "sources": sources,
        "inference_time": time.time() - start_time
    }

# --- STREAMING CHAT ENDPOINT ---
@app.post("/chat-stream")
async def chat_stream(req: ChatRequest):
    """
    The streaming version of the chat. Uses Server-Sent Events (SSE).
    """
    if not llm_service.llm:
        raise HTTPException(503, "Model is still loading...")

    # --- This is a generator function that FastAPI will use ---
    async def stream_generator():
        context_text = ""
        sources = []

        # 1. RAG Retrieval (same as before)
        if req.use_rag:
            retriever = rag_service.get_retriever()
            if retriever:
                try:
                    docs = retriever.invoke(req.message)
                    context_text = "\n\n".join([d.page_content for d in docs])
                    sources = list(set([d.metadata.get("source", "Unknown") for d in docs]))
                except Exception as e:
                    print(f"RAG Error: {e}")

        # 2. Prompt Engineering (same as before)
        if context_text:
            prompt = (
                f"Context from Guidelines:\n{context_text}\n\n"
                f"User Question: {req.message}\n\n"
                f"Instruction: Analyze the context and question."
            )
        else:
            prompt = req.message

        # 3. Call the LLM's streaming function
        # We loop through the JSON chunks yielded by llm_engine
        for chunk in llm_service.generate_stream(prompt):
            # Format as a Server-Sent Event (SSE) message
            # The 'data:' prefix and '\n\n' suffix are part of the SSE standard
            sse_message = f"data: {json.dumps(chunk)}\n\n"
            yield sse_message
            
        # 4. After the stream is done, send the sources
        source_chunk = {
            "type": "sources",
            "content": sources
        }
        yield f"data: {json.dumps(source_chunk)}\n\n"

        # 5. Send a final "done" message
        done_chunk = {"type": "done"}
        yield f"data: {json.dumps(done_chunk)}\n\n"


    # Return the generator function wrapped in a StreamingResponse
    return StreamingResponse(stream_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)