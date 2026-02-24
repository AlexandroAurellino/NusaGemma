import json
import multiprocessing
import time
import asyncio
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse

from app.models.schemas import ChatRequest, ToggleRequest
from app.services.llm_engine import llm_service
from app.services.rag_engine import rag_service, run_background_processing

router = APIRouter()

@router.get("/health")
def health_check():
    status = "online" if llm_service.llm else "offline"
    return {"system": "NusaGemma", "status": status, "mode": "Hierarchical Agent"}

@router.get("/documents")
def list_docs():
    return rag_service._load_registry()

@router.post("/documents/upload")
def upload_doc(
    background_tasks: BackgroundTasks, 
    file: UploadFile = File(...), 
    force: bool = False
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Only PDFs allowed")
    
    success, msg = rag_service.upload_pdf_init(file.file, file.filename, force_update=force)
    
    if success:
        # Spawn process using the standalone function imported from rag_engine
        process = multiprocessing.Process(target=run_background_processing, args=(file.filename,))
        process.start()
        return {"success": True, "message": "File accepted. Processing in a separate process."}
    else:
        raise HTTPException(409, detail=msg)

@router.post("/documents/toggle")
def toggle_doc(req: ToggleRequest):
    success = rag_service.toggle(req.filename, req.enabled)
    return {"success": success}

@router.delete("/documents/{filename}")
def delete_doc(filename: str):
    success = rag_service.delete_document(filename)
    if not success:
        raise HTTPException(404, detail="File not found")
    return {"success": success, "message": f"{filename} deleted"}

# --- AGENTIC CHAT STREAM ---
@router.post("/chat-stream")
async def chat_stream(req: ChatRequest):
    if not llm_service.llm:
        raise HTTPException(503, "Model is still loading...")

    async def stream_generator():
        context_text = None
        sources = []
        
        # Helper to format SSE messages safely
        def format_sse(data_dict):
            return f"data: {json.dumps(data_dict)}\n\n"

        if req.use_rag:
            # 1. Scanning
            yield format_sse({'type': 'thought', 'content': '🔍 Agent: Menganalisis pertanyaan pengguna...\n'})
            await asyncio.sleep(0.3)
            
            yield format_sse({'type': 'thought', 'content': '📚 Agent: Memindai ringkasan dokumen lokal...\n'})
            
            try:
                # Run the actual RAG search
                docs, source_names = rag_service.hierarchical_search(req.message)
                
                if source_names and docs:
                    msg = f"✅ Agent: Dokumen relevan ditemukan ({source_names[0]}).\n"
                    yield format_sse({'type': 'thought', 'content': msg})
                    await asyncio.sleep(0.3)
                    
                    yield format_sse({'type': 'thought', 'content': '✂️ Agent: Mengekstrak konteks klinis spesifik...\n'})
                    
                    context_text = "\n\n".join([d.page_content for d in docs])
                    sources = source_names
                else:
                    yield format_sse({'type': 'thought', 'content': '⚠️ Agent: Tidak ada dokumen relevan. Beralih ke Pengetahuan Umum.\n'})
                    context_text = None
                    
            except Exception as e:
                err_msg = f"❌ RAG Error: {e}. Beralih ke Pengetahuan Umum.\n"
                yield format_sse({'type': 'thought', 'content': err_msg})

        # Signal that the backend logic is done and LLM is taking over
        yield format_sse({'type': 'thought', 'content': '🧠 MedGemma: Memformulasikan jawaban akhir...\n'})
        
        # Now, stream the LLM's output directly into the final_answer box
        for chunk in llm_service.generate_stream(req.message, context=context_text):
            # chunk is already a dict, just dump it
            yield f"data: {json.dumps(chunk)}\n\n"
            
        # Send Sources
        if sources:
            source_chunk = {"type": "sources", "content": sources}
            yield f"data: {json.dumps(source_chunk)}\n\n"
        
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(stream_generator(), media_type="text/event-stream")