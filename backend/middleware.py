from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
import redis.asyncio as redis
import os
import time

REDIS_URL = os.getenv("REDIS_URL")

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 100, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        
        if REDIS_URL:
            # decode_responses=True is useful for string operations
            self.redis = redis.from_url(REDIS_URL, decode_responses=True)
        else:
            self.redis = None

    async def dispatch(self, request: Request, call_next):
        if not self.redis:
            # Skip rate limiting if Redis is not configured
            return await call_next(request)
            
        client_ip = request.client.host
        # Only rate limit API routes
        if request.url.path.startswith("/api/"):
            key = f"rate_limit:{client_ip}"

            try:
                # Increment first, then check/repair the TTL. The previous version only set
                # the TTL on the request that created the key (`if not current`) — if that
                # EXPIRE was ever lost (race condition, Redis restart with a stale RDB
                # snapshot, etc.) the key became permanent and every request from that IP
                # was rate-limited forever. Checking ttl == -1 on EVERY request self-heals
                # that instead of requiring a manual redis-cli fix.
                pipe = self.redis.pipeline()
                pipe.incr(key)
                pipe.ttl(key)
                count, ttl = await pipe.execute()
                if ttl == -1:
                    await self.redis.expire(key, self.window_seconds)
                if count > self.max_requests:
                    raise HTTPException(status_code=429, detail="Too Many Requests")
            except HTTPException:
                raise
            except Exception as e:
                # If Redis fails, log it and let request pass to not break production
                print(f"Redis Rate Limit Error: {e}")
                
        response = await call_next(request)
        return response
