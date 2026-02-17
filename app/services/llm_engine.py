import os
import sys
from langchain_community.llms import LlamaCpp
from app.core.config import settings

class LLMEngine:
    def __init__(self):
        self.llm = None
        self.load_model()

    def load_model(self):
        if not os.path.exists(settings.MODEL_PATH):
            print(f"❌ CRITICAL: Model not found at {settings.MODEL_PATH}")
            return

        print(f"🚀 Loading MedGemma GGUF: {settings.MODEL_FILENAME}...")
        try:
            self.llm = LlamaCpp(
                model_path=settings.MODEL_PATH,
                n_gpu_layers=0,       
                n_ctx=4096,           
                temperature=0.1,      
                max_tokens=2048,      
                top_p=0.9,
                repeat_penalty=1.2,
                stop=["<end_of_turn>", "<eos>"],
                verbose=False 
            )
            print("✅ MedGemma Engine Online.")
        except Exception as e:
            print(f"❌ Error loading engine: {e}")

    def create_summary(self, text_snippet: str) -> str:
        """
        Generates metadata card for the indexer.
        """
        if not self.llm: return "Summary unavailable."

        prompt = (
            f"<start_of_turn>user\n"
            f"Summarize this medical document. List the key topics, diseases, and patient demographics mentioned.\n\n"
            f"TEXT:\n{text_snippet[:3000]}...\n\n" 
            f"SUMMARY:\n"
            f"<end_of_turn>\n"
            f"<start_of_turn>model\n"
        )
        try:
            return self.llm.invoke(prompt).strip()
        except:
            return "Summary failed."

    def generate_stream(self, question: str, context: str = None):
        """
        Smart Streaming: Adapts prompt based on whether context is present.
        """
        if not self.llm:
            yield {"type": "error", "content": "AI Model not loaded."}
            return

        # --- DYNAMIC PROMPTING ---
        if context:
            # MODE A: RAG (Strict)
            system_instruction = (
                "You are an expert medical AI assistant. "
                "Answer the user's question based STRICTLY on the provided context below. "
                "If the answer is not in the context, admit it."
            )
            input_text = f"CONTEXT:\n{context}\n\nUSER QUESTION:\n{question}"
        else:
            # MODE B: GENERAL KNOWLEDGE (Fallback)
            system_instruction = (
                "You are NusaGemma, an expert medical AI for Indonesia. "
                "Answer the user's question using your internal medical knowledge. "
                "Be helpful, accurate, and concise."
            )
            input_text = f"USER QUESTION:\n{question}"

        formatted_prompt = (
            f"<start_of_turn>user\n"
            f"{system_instruction}\n\n"
            f"Step 1: Think step-by-step.\n"
            f"Step 2: Write '###RESPONSE###'.\n"
            f"Step 3: Write the final answer in Bahasa Indonesia.\n\n"
            f"{input_text}\n"
            f"<end_of_turn>\n"
            f"<start_of_turn>model\n"
        )
        
        is_thinking = True
        buffer = ""
        SEPARATOR = "###RESPONSE###"

        try:
            for token in self.llm.stream(formatted_prompt):
                buffer += token
                
                if is_thinking:
                    if SEPARATOR in buffer:
                        is_thinking = False
                        parts = buffer.split(SEPARATOR, 1)
                        thought = parts[0].strip()
                        ans = parts[1]
                        
                        if thought: yield {"type": "thought", "content": thought}
                        if ans: yield {"type": "final_answer", "content": ans}
                        buffer = "" 
                    else:
                        yield {"type": "thought", "content": token}
                else: 
                    yield {"type": "final_answer", "content": token}
            
            if is_thinking and buffer.strip():
                 yield {"type": "final_answer", "content": "\n" + buffer}

        except Exception as e:
            print(f"Stream Error: {e}")
            yield {"type": "final_answer", "content": f"[System Error: {str(e)}]"}

llm_service = LLMEngine()