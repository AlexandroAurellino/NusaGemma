import webview
import threading
import uvicorn

def jalankan_server():
    # Menggunakan string "app.main:app" agar uvicorn tahu posisinya ada di dalam folder 'app'
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000)

if __name__ == '__main__':
    t = threading.Thread(target=jalankan_server, daemon=True)
    t.start()
    
    webview.create_window('NusaGemma', 'http://127.0.0.1:8000', width=1280, height=800)
    webview.start()