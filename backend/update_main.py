import os

content = open("main.py").read()

injection = """from fastapi.responses import JSONResponse
from fastapi.requests import Request
import traceback

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Global Exception: {exc}")
    traceback.print_exc()
    return JSONResponse(status_code=500, content={"message": "Internal Server Error", "detail": str(exc)})

@app.get("/")"""

content = content.replace('@app.get("/")', injection)

open("main.py", "w").write(content)
print("Updated successfully")
