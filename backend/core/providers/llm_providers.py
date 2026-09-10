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
# Every id below was checked against ListModels on this project's key. Two entries that
# used to be here — gemini-2.0-flash and gemini-2.0-flash-lite — have been retired by
# Google and now 404 ("no longer available"). That silently shortened the chain from five
# models to three: a vision run over five images described one and skipped four, because
# 2.5-flash was rate-limited, flash-latest timed out, and the remaining two no longer
# exist. Ordered newest-stable first for capability, then the lite variants, which have
# their own separate daily quota. Deliberately no `-preview` ids: they move without notice
# and this list is on the hot path for creative, SEO, social and campaign generation.
_GEMINI_FALLBACK_MODELS = [
    "gemini-flash-latest",
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash",
]


def _is_rate_limit(err: Exception) -> bool:
    s = str(err).lower()
    return "429" in s or "quota" in s or "rate limit" in s or "resource_exhausted" in s


def _is_model_unavailable(err: Exception) -> bool:
    """A retired or unknown model, which is a reason to try the next one rather than fail.

    Google retires model ids on its own schedule - gemini-2.0-flash now answers every call
    with '404 ... is no longer available'. That is not a bad request the caller can fix, but
    the loop below treated any non-quota error as fatal and raised, so a single retired id
    in the fallback list could take down every generation that reached it.
    """
    s = str(err).lower()
    return "404" in s or "not found" in s or "no longer available" in s or "is not supported" in s


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
                if _is_model_unavailable(e):
                    print(f"Gemini {m} is retired/unavailable, trying next model...")
                    continue
                # Anything else (bad request, auth) - other models won't help.
                print(f"Gemini Error ({m}): {e}")
                raise LLMProviderError(f"Gemini call failed for model '{m}': {e}") from e
        raise LLMProviderError(f"All Gemini models exhausted (free-tier daily quota or no output). Last error: {last_err}")

    async def generate_with_image(self, prompt: str, image_bytes: bytes,
                                  mime_type: str = "image/jpeg",
                                  system_prompt: Optional[str] = None,
                                  model_name: str = "gemini-2.5-flash",
                                  max_output_tokens: Optional[int] = None, **kwargs) -> str:
        """Multimodal call: the same prompt plus one image.

        Deliberately a separate method rather than an argument on generate_text. That
        method is on the hot path for analytics, SEO, social and campaign generation, and
        threading an optional image through it would put every one of those callers behind
        a code path they never use.

        Keeps generate_text's per-model fallback, because the free tier's daily cap is per
        model and vision calls share it. Falls back to TEXT-ONLY on the last attempt: an
        answer grounded in the page copy beats no answer at all when every vision-capable
        model is exhausted.
        """
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise LLMProviderError("GEMINI_API_KEY is not set")
        if not image_bytes:
            return await self.generate_text(prompt, system_prompt, model_name,
                                            max_output_tokens, **kwargs)

        genai.configure(api_key=api_key)
        generation_config = (genai.GenerationConfig(max_output_tokens=max_output_tokens)
                             if max_output_tokens else None)

        image_part = {"mime_type": mime_type, "data": image_bytes}
        models_to_try = [model_name] + [m for m in _GEMINI_FALLBACK_MODELS if m != model_name]
        last_err = None
        for m in models_to_try:
            try:
                model = genai.GenerativeModel(m, system_instruction=system_prompt,
                                              generation_config=generation_config)
                response = await model.generate_content_async([prompt, image_part])
                text = _safe_response_text(response)
                if text.strip():
                    return text
                last_err = RuntimeError(f"'{m}' returned no text")
                continue
            except Exception as e:
                last_err = e
                if _is_rate_limit(e):
                    print(f"Gemini vision {m} rate-limited, trying next model...")
                    continue
                print(f"Gemini vision error ({m}): {e}")
                # A model that cannot accept an image is a per-model fact, not a fatal one.
                continue

        print(f"Gemini vision unavailable ({last_err}); falling back to text-only.")
        return await self.generate_text(prompt, system_prompt, model_name,
                                        max_output_tokens, **kwargs)


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
