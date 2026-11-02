@echo off
title GramScribe - Quick Setup Helper
echo ============================================================
echo           GramScribe - Quick Setup Helper
echo ============================================================
echo.
echo Opening Chrome Extensions page in your browser...
start chrome chrome://extensions/
echo.
echo ------------------------------------------------------------
echo Follow these 3 easy steps:
echo ------------------------------------------------------------
echo 1. In the top-right corner of Chrome, toggle ON [Developer mode].
echo 2. In the top-left corner, click [Load unpacked].
echo 3. Select this folder:
echo.
echo    %~dp0
echo.
echo ------------------------------------------------------------
echo Done! GramScribe will appear in your extensions toolbar.
echo ============================================================
echo.
pause
