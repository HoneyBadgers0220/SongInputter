@echo off
title SongRate
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoExit -File "%~dp0start.ps1"
pause
