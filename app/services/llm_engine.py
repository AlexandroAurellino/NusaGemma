import os
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
            # We are creating the LlamaCpp object here. The 'streamable' nature
            # is handled by how we CALL it (.stream() vs .invoke()).
            self.llm = LlamaCpp(
                model_path=settings.MODEL_PATH,
                n_gpu_layers=0,
                n_ctx=4096,
                temperature=0.1,
                max_tokens=1024, # Increase max tokens for thought + answer
                top_p=0.9,
                repeat_penalty=1.2,
                stop=["<end_of_turn>", "<eos>"],
                # Set verbose to False to keep the terminal clean during streaming
                verbose=False 
            )
            print("✅ MedGemma Engine Online (Ready for Streaming).")
        except Exception as e:
            print(f"❌ Error loading engine: {e}")

    def generate_stream(self, prompt: str):
        """
        Yields structured JSON chunks. 
        Uses a hard delimiter '###RESPONSE###' to separate thought from answer.
        """
        if not self.llm:
            yield {"type": "error", "content": "AI Model not loaded."}
            return

        # 1. THE PROMPT: Force the separator
        formatted_prompt = (
            f"<start_of_turn>user\n"
            f"You are NusaGemma. \n"
            f"Step 1: Think silently about the context and question.\n"
            f"Step 2: When ready, write exactly '###RESPONSE###'.\n"
            f"Step 3: Write the final answer in Bahasa Indonesia.\n\n"
            f"{prompt}\n"
            f"<end_of_turn>\n"
            f"<start_of_turn>model\n"
        )
        
        # 2. THE STREAMING LOGIC
        is_thinking = True
        buffer = ""
        
        # We look for this specific string to flip the switch
        SEPARATOR = "###RESPONSE###"

        for token in self.llm.stream(formatted_prompt):
            buffer += token
            
            if is_thinking:
                # Check if the separator has appeared in the buffer
                if SEPARATOR in buffer:
                    is_thinking = False
                    
                    # Split: Everything before separator is thought
                    parts = buffer.split(SEPARATOR, 1)
                    thought_content = parts[0].strip()
                    answer_content = parts[1] # The start of the answer
                    
                    # 1. Flush the remaining thought
                    if thought_content:
                        # Clean up any trailing labels like "Step 1:"
                        yield {"type": "thought", "content": thought_content}
                    
                    # 2. Flush the start of the answer
                    if answer_content:
                        yield {"type": "final_answer", "content": answer_content}
                    
                    buffer = "" # Clear buffer, we are now in direct passthrough mode
                else:
                    # OPTIMIZATION: Don't yield every single character for thoughts, 
                    # it slows down the browser. Yield every 10 chars or just keep buffering.
                    # For now, we yield regularly to show activity.
                    yield {"type": "thought", "content": token}
                    # Note: The frontend appends this to the thought box. 
                    # When we eventually find the separator, the user will see the thought finish.
            
            else: 
                # We found the separator! Just stream the answer directly.
                yield {"type": "final_answer", "content": token}
                
        # Fallback: If model finished but never wrote '###RESPONSE###'
        # We assume the whole thing was the answer (or the thought failed)
        if is_thinking and buffer.strip():
             # Heuristic: If it's short, it's an answer. If long, it might be a stuck thought.
             # Let's just output it as final answer to be safe.
             yield {"type": "final_answer", "content": buffer}

# Singleton Instance
llm_service = LLMEngine()