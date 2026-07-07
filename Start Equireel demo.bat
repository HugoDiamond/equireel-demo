@echo off
cd /d "%~dp0"
start "" cmd /c "timeout /t 8 /nobreak >nul && start http://localhost:8734"
call npm run demo
