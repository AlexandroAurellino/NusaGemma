# app/models/schemas.py

from pydantic import BaseModel
from typing import List, Optional

class ChatRequest(BaseModel):
    message: str
    use_rag: bool = True

class ChatResponse(BaseModel):
    response: str
    used_rag: bool
    sources: List[str]
    inference_time: float

class DocStatus(BaseModel):
    filename: str
    enabled: bool
    chunk_count: int

class ToggleRequest(BaseModel):
    filename: str
    enabled: bool