from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.api.routes import router as api_router

app = FastAPI(title="NusaGemma API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"], # Izinkan Live Server
    allow_credentials=True,
    allow_methods=["*"], # Mengizinkan semua method termasuk POST, DELETE, dll
    allow_headers=["*"], # Mengizinkan semua header
)

# Static Files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Routes
app.include_router(api_router)

@app.get("/")
async def read_root():
    return FileResponse('static/index.html')

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)