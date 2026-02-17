import os

class Settings:
    BASE_DIR = os.getcwd()
    
    # --- MODEL SETTINGS ---
    MODEL_DIR = os.path.join(BASE_DIR, "models")
    # Exact filename of your GGUF
    MODEL_FILENAME = "medgemma-4b-it-Q4_K_M.gguf" 
    MODEL_PATH = os.path.join(MODEL_DIR, MODEL_FILENAME)
    
    # --- DATA PATHS ---
    DATA_DIR = os.path.join(BASE_DIR, "data")
    GUIDELINES_DIR = os.path.join(DATA_DIR, "guidelines")
    
    # Registry (Tracks file status: 'processing', 'ready', 'error')
    REGISTRY_PATH = os.path.join(DATA_DIR, "registry.json")
    
    # --- DUAL VECTOR DATABASES (Hierarchical RAG) ---
    # 1. Chunk DB: Stores the deep content (Thousands of vectors)
    VECTOR_DB_CHUNK_DIR = os.path.join(DATA_DIR, "vector_db_chunks")
    
    # 2. Summary DB: Stores the high-level description of each file (Few vectors)
    VECTOR_DB_SUMMARY_DIR = os.path.join(DATA_DIR, "vector_db_summaries")
    
    # Embedding Cache
    EMBED_CACHE_DIR = os.path.join(MODEL_DIR, "embed_cache")

settings = Settings()