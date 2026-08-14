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
            # Short timeouts because this runs in front of EVERY /api/ request. The failure
            # below is already handled (we log and let the request through), but with the
            # default timeouts an unhealthy Redis - one that accepts TCP but never answers -
            # stalls every call for seconds before that handling kicks in. Failing in 0.3s
            # keeps a broken Redis from looking like a broken backend.
            # decode_responses=True is useful for string operations
            self.redis = redis.from_url(
                REDIS_URL, decode_responses=True,
                socket_connect_timeout=0.3, socket_timeout=0.3,
            )
            self._redis_failures = 0
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
                # If Redis fails, log it and let request pass to not break production.
                # After a run of consecutive failures, stop calling Redis entirely: a dead
                # Redis is not coming back mid-process, and paying the timeout (plus a log
                # line) on every request just makes the whole API look slow. Restart the
                # process once Redis is healthy to re-enable rate limiting.
                self._redis_failures += 1
                if self._redis_failures >= 5:
                    print("Redis unreachable 5x — disabling rate limiting for this process.")
                    self.redis = None
                else:
                    print(f"Redis Rate Limit Error: {e}")
                
        response = await call_next(request)
        return response
