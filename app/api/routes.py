import json
import time
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse

from app.models.schemas import ChatRequest, ToggleRequest
from app.services.llm_engine import llm_service
from app.services.rag_engine import rag_service

router = APIRouter()

@router.get("/health")
def health_check():
    status = "online" if llm_service.llm else "offline"
    return {"system": "NusaGemma", "status": status, "mode": "Hierarchical Agent"}

@router.get("/documents")
def list_docs():
    return rag_service.registry

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
        # TRIGGER BACKGROUND TASK
        background_tasks.add_task(rag_service.process_document_background, file.filename)
        return {"success": True, "message": "File accepted. Processing in background."}
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

@router.post("/chat-stream")
async def chat_stream(req: ChatRequest):
    if not llm_service.llm:
        raise HTTPException(503, "Model is still loading...")

    async def stream_generator():
        context_text = None # Default to None (General Mode)
        sources = []

        # 1. HIERARCHICAL RAG ATTEMPT
        if req.use_rag:
            yield f"data: {json.dumps({'type': 'thought', 'content': '🕵️ Agent: Scanning document summaries...'})}\n\n"
            
            try:
                docs, source_names = rag_service.hierarchical_search(req.message)
                
                if source_names and docs:
                    yield f"data: {json.dumps({'type': 'thought', 'content': f' Found match in {source_names[0]}. Reading...'})}\n\n"
                    context_text = "\n\n".join([d.page_content for d in docs])
                    sources = source_names
                else:
                    # RAG FAILED TO FIND DOCS
                    yield f"data: {json.dumps({'type': 'thought', 'content': ' No relevant documents found. Switching to General Knowledge Mode.'})}\n\n"
                    context_text = None # Explicitly set to None
                    
            except Exception as e:
                print(f"RAG Error: {e}")
                yield f"data: {json.dumps({'type': 'thought', 'content': f' RAG Error: {e}. Using General Knowledge.'})}\n\n"

        # 2. GENERATION (With Fallback)
        # We pass context_text. If it's None, llm_engine uses General Mode.
        for chunk in llm_service.generate_stream(req.message, context=context_text):
            yield f"data: {json.dumps(chunk)}\n\n"
            
        # 3. Sources (Only if RAG was used)
        if sources:
            source_chunk = {"type": "sources", "content": sources}
            yield f"data: {json.dumps(source_chunk)}\n\n"
        
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(stream_generator(), media_type="text/event-stream")