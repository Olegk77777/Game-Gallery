@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Установите Node.js LTS с https://nodejs.org и откройте этот файл снова.
  pause
  exit /b 1
)
node -e "require('sharp')" >nul 2>nul
if errorlevel 1 (
  call npm ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
node album-manager/launch.mjs
if errorlevel 1 pause
