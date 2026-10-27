@echo off
setlocal
cd /d "%~dp0"
set "STUDIO_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "STUDIO_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%STUDIO_NODE%" preview.mjs --open
if errorlevel 1 pause
