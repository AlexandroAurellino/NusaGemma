import os
import json
import shutil
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter 
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.docstore.document import Document
from app.core.config import settings
from app.services.llm_engine import llm_service

def run_background_processing(filename: str):
    """
    The Heavy Lifting Task. Runs in a separate process.
    It creates its own instances of the engines to avoid shared memory issues.
    """
    # Re-initialize services within the new process
    print(f"⚙️ NEW PROCESS SPAWNED (PID: {os.getpid()}) FOR: {filename}")
    
    # We need a temporary RAGEngine instance just for this process's scope
    temp_rag_service = RAGEngine()
    file_path = os.path.join(settings.GUIDELINES_DIR, filename)
    
    try:
        # 1. Load PDF
        loader = PyPDFLoader(file_path)
        raw_docs = loader.load()
        full_text = "\n".join([d.page_content for d in raw_docs])
        
        # 2. Generate Summary (The slow part)
        print(f"🧠 Generating Summary for {filename}...")
        summary_text = llm_service.create_summary(full_text)
        print(f"📝 Summary: {summary_text}")
        
        # 3. Store Summary
        summary_doc = Document(page_content=summary_text, metadata={"source": filename})
        temp_rag_service.summary_db.add_documents([summary_doc])
        temp_rag_service.summary_db.persist()
        
        # 4. Chunk & Store
        print(f"🔪 Chunking {filename}...")
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1200, chunk_overlap=200)
        chunks = text_splitter.split_documents(raw_docs)
        for c in chunks: c.metadata["source"] = filename
        
        temp_rag_service.chunk_db.add_documents(chunks)
        temp_rag_service.chunk_db.persist()

        # 5. Update Registry to READY (directly writing to the file)
        # This is how we communicate back to the main process
        current_registry = temp_rag_service._load_registry()
        current_registry[filename]["status"] = "ready"
        current_registry[filename]["summary"] = summary_text
        current_registry[filename]["chunks"] = len(chunks)
        
        with open(settings.REGISTRY_PATH, "w") as f:
            json.dump(current_registry, f, indent=4)
            
        print(f"✅ FINISHED: {filename} is ready.")
        
    except Exception as e:
        print(f"❌ PROCESSING FAILED IN CHILD PROCESS: {str(e)}")
        # Update registry with error status
        current_registry = temp_rag_service._load_registry()
        if filename in current_registry:
            current_registry[filename]["status"] = "error"
            current_registry[filename]["error"] = str(e)
            with open(settings.REGISTRY_PATH, "w") as f:
                json.dump(current_registry, f, indent=4)

class RAGEngine:
    def __init__(self):
        os.makedirs(settings.GUIDELINES_DIR, exist_ok=True)
        self.embedding_fn = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={'device': 'cpu'},
            cache_folder=settings.EMBED_CACHE_DIR
        )
        self.summary_db = Chroma(collection_name="summaries", persist_directory=settings.VECTOR_DB_SUMMARY_DIR, embedding_function=self.embedding_fn)
        self.chunk_db = Chroma(collection_name="chunks", persist_directory=settings.VECTOR_DB_CHUNK_DIR, embedding_function=self.embedding_fn)
        self.registry = self._load_registry()

    def _load_registry(self):
        if os.path.exists(settings.REGISTRY_PATH):
            with open(settings.REGISTRY_PATH, "r") as f:
                try:
                    return json.load(f)
                except json.JSONDecodeError:
                    return {} # Handle empty/corrupt file
        return {}

    def _save_registry(self):
        with open(settings.REGISTRY_PATH, "w") as f:
            json.dump(self.registry, f, indent=4)

    def _sanitize_pdf(self, path):
        try:
            with open(path, 'rb') as f: content = f.read()
            if not content.startswith(b'%PDF'):
                start = content.find(b'%PDF')
                if start > 0:
                    with open(path, 'wb') as f: f.write(content[start:])
        except: pass

    def upload_pdf_init(self, file_obj, filename, force_update=False):
        file_path = os.path.join(settings.GUIDELINES_DIR, filename)
        
        if filename in self.registry and not force_update:
            return False, "File exists"

        if filename in self.registry:
            self.delete_document(filename)

        with open(file_path, "wb") as f:
            shutil.copyfileobj(file_obj, f)
        self._sanitize_pdf(file_path)

        self.registry[filename] = {"enabled": True, "status": "processing", "chunks": 0}
        self._save_registry()
        return True, "File saved. Background processing started."

    def delete_document(self, filename):
        try:
            self.chunk_db._collection.delete(where={"source": filename})
            self.summary_db._collection.delete(where={"source": filename})
        except: pass
        
        path = os.path.join(settings.GUIDELINES_DIR, filename)
        if os.path.exists(path): os.remove(path)
        
        if filename in self.registry:
            del self.registry[filename]
            self._save_registry()
        return True

    def toggle(self, filename, enabled):
        if filename in self.registry:
            self.registry[filename]["enabled"] = enabled
            self._save_registry()
            return True
        return False

    def hierarchical_search(self, query: str):
        self.registry = self._load_registry() # Refresh state
        active_files = [f for f, d in self.registry.items() if d.get("enabled") and d.get("status") == "ready"]
        if not active_files: return [], []

        search_filter = {"source": {"$in": active_files}} if len(active_files) > 1 else {"source": active_files[0]}
        
        summary_results = self.summary_db.similarity_search(query, k=1, filter=search_filter)
        if not summary_results: return [], []

        best_doc_name = summary_results[0].metadata["source"]
        
        chunk_results = self.chunk_db.similarity_search(query, k=6, filter={"source": best_doc_name})
        return chunk_results, [best_doc_name]

rag_service = RAGEngine()