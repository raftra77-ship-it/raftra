import os
import google.generativeai as genai
from typing import Optional
from .base import LLMProvider

try:
    from headroom import compress
except ImportError:
    compress = None  # Fallback if headroom is not fully installed yet

class GeminiProvider(LLMProvider):
    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None, model_name: str = "gemini-1.5-flash", **kwargs) -> str:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return "Error: GEMINI_API_KEY is not set."
            
        genai.configure(api_key=api_key)
        
        # HEADROOM COMPRESSION
        if compress:
            try:
                # We format it as a messages array for headroom
                msgs = [{"role": "user", "content": prompt}]
                if system_prompt:
                    msgs.insert(0, {"role": "system", "content": system_prompt})
                compressed_msgs = compress(msgs)
                # Re-extract
                prompt = next((m["content"] for m in compressed_msgs if m["role"] == "user"), prompt)
                system_prompt = next((m["content"] for m in compressed_msgs if m["role"] == "system"), system_prompt)
            except Exception as e:
                print(f"Headroom compression skipped for Gemini: {e}")
        
        model = genai.GenerativeModel(model_name, system_instruction=system_prompt)
        try:
            response = await model.generate_content_async(prompt)
            return response.text
        except Exception as e:
            print(f"Gemini Error: {str(e)}")
            return f"Strategic Free-Tier Mock Response for: {prompt[:30]}... (Gemini API Error)"

class OpenRouterProvider(LLMProvider):
    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None, model_name: str = "meta-llama/llama-3.2-3b-instruct:free", **kwargs) -> str:
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            return "Error: OPENROUTER_API_KEY is not set."
            
        import openai
        client = openai.AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
        )
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        # HEADROOM COMPRESSION
        if compress:
            try:
                messages = compress(messages)
            except Exception as e:
                print(f"Headroom compression skipped for OpenRouter: {e}")
        
        try:
            completion = await client.chat.completions.create(
                model=model_name,
                messages=messages,
            )
            return completion.choices[0].message.content
        except Exception as e:
            err_str = str(e)
            print(f"OpenRouter Error: {err_str}")
            return f"Strategic Free-Tier Mock Response for: {prompt[:30]}... (OpenRouter limit reached)"

class OpenAIProvider(LLMProvider):
    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None, **kwargs) -> str:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return "Error: OPENAI_API_KEY is not set."
            
        import openai
        client = openai.AsyncOpenAI(api_key=api_key)
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        try:
            completion = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
            )
            return completion.choices[0].message.content
        except Exception as e:
            print(f"OpenAI Error: {str(e)}")
            return f"Strategic Free-Tier Mock Response for: {prompt[:30]}... (OpenAI limit reached)"

class AnthropicProvider(LLMProvider):
    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None, **kwargs) -> str:
        # TODO: Implement Anthropic Claude call
        return f"[AnthropicProvider] Mock Response for: {prompt[:20]}..."
