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

class RAGEngine:
    def __init__(self):
        # Ensure directories
        os.makedirs(settings.GUIDELINES_DIR, exist_ok=True)
        os.makedirs(settings.VECTOR_DB_CHUNK_DIR, exist_ok=True)
        os.makedirs(settings.VECTOR_DB_SUMMARY_DIR, exist_ok=True)
        
        # Load Embeddings
        self.embedding_fn = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True},
            cache_folder=settings.EMBED_CACHE_DIR
        )
        
        # 1. Summary DB (High Level)
        self.summary_db = Chroma(
            collection_name="summaries",
            persist_directory=settings.VECTOR_DB_SUMMARY_DIR, 
            embedding_function=self.embedding_fn
        )
        
        # 2. Chunk DB (Deep Dive)
        self.chunk_db = Chroma(
            collection_name="chunks",
            persist_directory=settings.VECTOR_DB_CHUNK_DIR, 
            embedding_function=self.embedding_fn
        )
        
        self.registry = self._load_registry()

    def _load_registry(self):
        if os.path.exists(settings.REGISTRY_PATH):
            with open(settings.REGISTRY_PATH, "r") as f:
                return json.load(f)
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

    def process_document_background(self, filename: str):
        """
        Background Task: Reads, Summarizes, and Chunks the PDF.
        """
        file_path = os.path.join(settings.GUIDELINES_DIR, filename)
        print(f"⚙️ PROCESSING BACKGROUND: {filename}")
        
        try:
            # 1. Load PDF
            loader = PyPDFLoader(file_path)
            raw_docs = loader.load()
            full_text = "\n".join([d.page_content for d in raw_docs])
            
            # 2. Generate Summary
            print(f"🧠 Generating Summary for {filename}...")
            summary_text = llm_service.create_summary(full_text)
            
            # 3. Store Summary
            summary_doc = Document(
                page_content=summary_text,
                metadata={"source": filename, "type": "summary"}
            )
            self.summary_db.add_documents([summary_doc])
            self.summary_db.persist()
            
            # 4. Chunk Content
            print(f"🔪 Chunking {filename}...")
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1200, chunk_overlap=200, separators=["\n\n", "\n", " ", ""]
            )
            chunks = text_splitter.split_documents(raw_docs)
            for c in chunks: c.metadata["source"] = filename
            
            self.chunk_db.add_documents(chunks)
            self.chunk_db.persist()

            # 5. Update Registry to READY
            self.registry[filename]["status"] = "ready"
            self.registry[filename]["summary"] = summary_text
            self.registry[filename]["chunks"] = len(chunks)
            self._save_registry()
            print(f"✅ FINISHED: {filename} is ready.")
            
        except Exception as e:
            print(f"❌ PROCESSING FAILED: {str(e)}")
            self.registry[filename]["status"] = "error"
            self.registry[filename]["error"] = str(e)
            self._save_registry()

    def upload_pdf_init(self, file_obj, filename, force_update=False):
        """Initializes upload and sets status to 'processing'."""
        file_path = os.path.join(settings.GUIDELINES_DIR, filename)
        
        if filename in self.registry and not force_update:
            return False, "File exists"

        if filename in self.registry:
            self.delete_document(filename)

        with open(file_path, "wb") as f:
            shutil.copyfileobj(file_obj, f)
        self._sanitize_pdf(file_path)

        self.registry[filename] = {
            "enabled": True, "status": "processing", "chunks": 0
        }
        self._save_registry()
        return True, "File saved. Processing started."

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
        """
        Phase 1: Scan Summaries. Phase 2: Deep Dive into best file.
        """
        active_files = [f for f, d in self.registry.items() if d.get("enabled") and d.get("status") == "ready"]
        if not active_files: return [], []

        # Phase 1: Search Summaries
        search_filter = {"source": {"$in": active_files}} if len(active_files) > 1 else {"source": active_files[0]}
        summary_results = self.summary_db.similarity_search(query, k=1, filter=search_filter)
        
        if not summary_results: return [], []

        best_doc_name = summary_results[0].metadata["source"]
        
        # Phase 2: Deep Dive Chunks
        chunk_results = self.chunk_db.similarity_search(
            query, k=6, filter={"source": best_doc_name}
        )
        return chunk_results, [best_doc_name]

rag_service = RAGEngine()