@echo off
TITLE NusaGemma Server
COLOR 0A

echo =====================================================
echo   STARTING NUSAGEMMA - RURAL HEALTH AI SYSTEM
echo =====================================================
echo.
echo [1/3] Activating Virtual Environment...
call venv\Scripts\activate

echo [2/3] Starting AI Engine (Backend)...
echo       Please wait for "Application startup complete"...
echo.

:: Start Uvicorn in the background using 'start'
:: This opens a separate window for the server logs (good for demo)
start "NusaGemma Backend" cmd /k "uvicorn app.main:app --host 127.0.0.1 --port 8000"

:: Wait 5 seconds for the server to warm up
timeout /t 5 /nobreak >nul

echo [3/3] Launching Interface...
:: Open Default Browser in "App Mode" (No address bar)
:: Works with Chrome, Edge, Brave
start http://127.0.0.1:8000/

echo.
echo =====================================================
echo   SYSTEM READY. DO NOT CLOSE THIS WINDOW.
echo =====================================================
pause`