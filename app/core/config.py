# app/core/config.py

import os

class Settings:
    BASE_DIR = os.getcwd()
    
    # Model Paths
    MODEL_DIR = os.path.join(BASE_DIR, "models")
    # MAKE SURE THIS MATCHES YOUR FILENAME EXACTLY
    MODEL_FILENAME = "medgemma-4b-it-Q4_K_M.gguf" 
    MODEL_PATH = os.path.join(MODEL_DIR, MODEL_FILENAME)
    
    # Data Paths
    DATA_DIR = os.path.join(BASE_DIR, "data")
    GUIDELINES_DIR = os.path.join(DATA_DIR, "guidelines")
    VECTOR_DB_DIR = os.path.join(DATA_DIR, "vector_db")
    REGISTRY_PATH = os.path.join(DATA_DIR, "registry.json")
    
    # Embedding Model Cache
    EMBED_CACHE_DIR = os.path.join(MODEL_DIR, "embed_cache")

settings = Settings()