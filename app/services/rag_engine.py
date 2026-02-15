# app/services/rag_engine.py

import os
import json
import shutil
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from app.core.config import settings

class RAGEngine:
    def __init__(self):
        # Ensure directories exist
        os.makedirs(settings.GUIDELINES_DIR, exist_ok=True)
        
        # Load Embeddings
        self.embedding_fn = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True},
            cache_folder=settings.EMBED_CACHE_DIR
        )
        
        # Load DB
        self.db = Chroma(
            persist_directory=settings.VECTOR_DB_DIR, 
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
        """Fixes junk bytes in headers"""
        try:
            with open(path, 'rb') as f:
                content = f.read()
            if not content.startswith(b'%PDF'):
                start = content.find(b'%PDF')
                if start > 0:
                    with open(path, 'wb') as f:
                        f.write(content[start:])
        except:
            pass

    def upload_pdf(self, file_obj, filename):
        file_path = os.path.join(settings.GUIDELINES_DIR, filename)
        
        if filename in self.registry:
            return False, "File already exists"

        # Save & Sanitize
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file_obj, f)
        self._sanitize_pdf(file_path)

        # Process
        loader = PyPDFLoader(file_path)

        # TUNING: Increased chunk size to 1200 to capture wide tables in Medical PDFs
        # Increased overlap to 200 to ensure headers aren't lost
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1200, 
            chunk_overlap=200,
            separators=["\n\n", "\n", " ", ""] # Try to keep paragraphs together
        )
        chunks = text_splitter.split_documents(loader.load())
        
        # Add Metadata
        for c in chunks: 
            c.metadata["source"] = filename
            
        self.db.add_documents(chunks)
        self.db.persist()

        # Update Registry
        self.registry[filename] = {"enabled": True, "count": len(chunks)}
        self._save_registry()
        
        return True, f"Processed {len(chunks)} chunks"

    def get_retriever(self):
        """Builds a retriever filtering only enabled docs"""
        active_files = [f for f, data in self.registry.items() if data["enabled"]]
        
        if not active_files: return None
        
        search_filter = {"source": active_files[0]} if len(active_files) == 1 else {"source": {"$in": active_files}}
        
        return self.db.as_retriever(search_kwargs={"k": 9, "filter": search_filter})

    def toggle(self, filename, enabled):
        if filename in self.registry:
            self.registry[filename]["enabled"] = enabled
            self._save_registry()
            return True
        return False

rag_service = RAGEngine()