import os
import google.generativeai as genai
from typing import Optional
from .base import LLMProvider, LLMProviderError

try:
    from headroom import compress
except ImportError:
    compress = None  # Fallback if headroom is not fully installed yet

# Gemini's free tier limits requests PER DAY, PER MODEL. When the selected model hits
# its daily cap (429), a *different* model still has its own quota on the same key - so
# we fall through this list rather than failing the whole pipeline.
_GEMINI_FALLBACK_MODELS = [
    "gemini-flash-latest",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-2.5-flash",
]


def _is_rate_limit(err: Exception) -> bool:
    s = str(err).lower()
    return "429" in s or "quota" in s or "rate limit" in s or "resource_exhausted" in s


def _safe_response_text(response) -> str:
    """Extract text without raising. `response.text` throws when a candidate has no
    text part (e.g. a 2.5 'thinking' model that spent the whole token budget thinking,
    or a safety block). We return '' in that case so the caller can try another model."""
    try:
        return response.text or ""
    except Exception:
        try:
            parts = response.candidates[0].content.parts
            return "".join(getattr(p, "text", "") or "" for p in parts)
        except Exception:
            return ""

class GeminiProvider(LLMProvider):
    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None, model_name: str = "gemini-2.5-flash", max_output_tokens: Optional[int] = None, **kwargs) -> str:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise LLMProviderError("GEMINI_API_KEY is not set")

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

        # No cap by default (existing callers - analytics/SEO/social - rely on long-form
        # output). Callers that want short, fast output (ad strategy/copy) pass this in.
        generation_config = genai.GenerationConfig(max_output_tokens=max_output_tokens) if max_output_tokens else None

        # Try the requested model first, then fall through to models with separate quotas.
        models_to_try = [model_name] + [m for m in _GEMINI_FALLBACK_MODELS if m != model_name]
        last_err = None
        for m in models_to_try:
            try:
                model = genai.GenerativeModel(m, system_instruction=system_prompt, generation_config=generation_config)
                response = await model.generate_content_async(prompt)
                text = _safe_response_text(response)
                if text.strip():
                    if m != model_name:
                        print(f"Gemini: '{model_name}' unavailable; served with '{m}' instead.")
                    return text
                # Empty (thinking-only / truncated / blocked): try the next model.
                last_err = RuntimeError(f"'{m}' returned no text")
                print(f"Gemini {m} returned empty text, trying next model...")
                continue
            except Exception as e:
                last_err = e
                if _is_rate_limit(e):
                    print(f"Gemini {m} rate-limited (daily quota), trying next model...")
                    continue
                # Non-quota error (bad request, etc.) - other models won't help.
                print(f"Gemini Error ({m}): {e}")
                raise LLMProviderError(f"Gemini call failed for model '{m}': {e}") from e
        raise LLMProviderError(f"All Gemini models exhausted (free-tier daily quota or no output). Last error: {last_err}")

class OpenRouterProvider(LLMProvider):
    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None, model_name: str = "meta-llama/llama-3.2-3b-instruct:free", max_output_tokens: Optional[int] = None, **kwargs) -> str:
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise LLMProviderError("OPENROUTER_API_KEY is not set")

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
                **({"max_tokens": max_output_tokens} if max_output_tokens else {}),
            )
            return completion.choices[0].message.content
        except Exception as e:
            print(f"OpenRouter Error ({model_name}): {e}")
            raise LLMProviderError(f"OpenRouter call failed for model '{model_name}': {e}") from e

class OpenAIProvider(LLMProvider):
    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None, **kwargs) -> str:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise LLMProviderError("OPENAI_API_KEY is not set")

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
            print(f"OpenAI Error: {e}")
            raise LLMProviderError(f"OpenAI call failed: {e}") from e

class AnthropicProvider(LLMProvider):
    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None, **kwargs) -> str:
        # Not implemented: fail loudly rather than returning mock text that would be
        # indistinguishable from a real response.
        raise LLMProviderError("AnthropicProvider is not implemented yet")
