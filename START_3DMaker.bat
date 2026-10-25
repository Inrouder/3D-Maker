@echo off
setlocal
title 3DMaker starten
cd /d "%~dp0"

echo.
echo ========================================
echo           3DMaker starten
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo FEHLER: Node.js wurde nicht gefunden.
  echo Bitte installiere die aktuelle Node.js-LTS-Version:
  echo https://nodejs.org/
  echo Danach diese Datei erneut starten.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo FEHLER: npm wurde nicht gefunden. Bitte Node.js erneut installieren.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Ersteinrichtung: Abhaengigkeiten werden installiert.
  echo Das kann beim ersten Start einige Minuten dauern.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo FEHLER: Installation fehlgeschlagen. Pruefe deine Internetverbindung.
    pause
    exit /b 1
  )
)

echo Starte 3DMaker im Browser...
echo Dieses Fenster waehrend der Nutzung geoeffnet lassen.
echo Zum Beenden Strg+C druecken oder das Fenster schliessen.
echo.
call npm run dev -- --host 127.0.0.1 --open
if errorlevel 1 (
  echo.
  echo 3DMaker konnte nicht gestartet werden.
  pause
)
endlocal
