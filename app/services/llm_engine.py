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
                max_tokens=1024, # Reduced because it no longer needs room for "thoughts"     
                top_p=0.9,
                repeat_penalty=1.2,
                stop=["<end_of_turn>", "<eos>"],
                verbose=False 
            )
            print("✅ MedGemma Engine Online.")
        except Exception as e:
            print(f"❌ Error loading engine: {e}")

    def create_summary(self, text_snippet: str) -> str:
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
        Clean Streaming: The LLM ONLY outputs the final answer. No tags.
        """
        if not self.llm:
            yield {"type": "error", "content": "AI Model not loaded."}
            return

        # STRICT PROMPTING: Do not think, just answer.
        if context:
            system_instruction = (
                "Anda adalah NusaGemma, asisten AI medis untuk Puskesmas di Indonesia.\n"
                "TUGAS: Jawab pertanyaan pengguna berdasarkan KONTEKS yang diberikan.\n"
                "ATURAN: Jawab secara langsung, ringkas, dan HANYA gunakan Bahasa Indonesia. JANGAN menulis proses pemikiran Anda."
            )
            input_text = f"KONTEKS:\n{context}\n\nPERTANYAAN PENGGUNA:\n{question}"
        else:
            system_instruction = (
                "Anda adalah NusaGemma, asisten AI medis untuk Puskesmas di Indonesia.\n"
                "TUGAS: Jawab pertanyaan pengguna menggunakan pengetahuan medis Anda.\n"
                "ATURAN: Jawab secara langsung, ringkas, dan HANYA gunakan Bahasa Indonesia. JANGAN menulis proses pemikiran Anda."
            )
            input_text = f"PERTANYAAN PENGGUNA:\n{question}"

        formatted_prompt = (
            f"<start_of_turn>user\n"
            f"{system_instruction}\n\n"
            f"{input_text}\n"
            f"<end_of_turn>\n"
            f"<start_of_turn>model\n"
        )

        try:
            for token in self.llm.stream(formatted_prompt):
                # Because the prompt forbids thinking, EVERYTHING the model outputs 
                # is guaranteed to be the final answer. We stream it directly.
                yield {"type": "final_answer", "content": token}

        except Exception as e:
            print(f"Stream Error: {e}")
            yield {"type": "final_answer", "content": f"\n[System Error: {str(e)}]"}

llm_service = LLMEngine()