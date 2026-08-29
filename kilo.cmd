@echo off
setlocal

set "KILO_EXE="
for /f "delims=" %%I in ('powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$p = Get-ChildItem -Directory -Path (Join-Path $env:USERPROFILE '.vscode\extensions') -Filter 'kilocode.kilo-code-*-win32-x64' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName 'bin\kilo.exe' } | Where-Object { Test-Path $_ } | Select-Object -First 1; if ($p) { Write-Output $p }"') do set "KILO_EXE=%%I"

if not defined KILO_EXE (
    echo KILO_CLI_NOT_FOUND 1>&2
    exit /b 9009
)

"%KILO_EXE%" %*
exit /b %ERRORLEVEL%
