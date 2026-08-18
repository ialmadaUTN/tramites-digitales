@echo off
setlocal

rem Inicia todos los servicios locales necesarios para TramitesDigitales.
pushd "%~dp0"

set "PNPM_CMD=pnpm"
where pnpm >nul 2>&1
if errorlevel 1 (
    rem En algunas instalaciones pnpm se ejecuta mediante Corepack.
    if exist "%LocalAppData%\Programs\nodejs\corepack.cmd" (
        set "PATH=%LocalAppData%\Programs\nodejs;%PATH%"
        set "PNPM_CMD=corepack pnpm"
    ) else if exist "%ProgramFiles%\nodejs\corepack.cmd" (
        set "PATH=%ProgramFiles%\nodejs;%PATH%"
        set "PNPM_CMD=corepack pnpm"
    ) else if exist "%LocalAppData%\Programs\node-v24.18.1-win-x64\corepack.cmd" (
        set "PATH=%LocalAppData%\Programs\node-v24.18.1-win-x64;%PATH%"
        set "PNPM_CMD=corepack pnpm"
    ) else (
        echo No se encontro pnpm ni Corepack.
        echo Instala Node.js 22+ y pnpm 11, y vuelve a ejecutar este archivo.
        pause
        popd
        exit /b 1
    )
)

if not exist "node_modules" (
    echo No se encontro node_modules.
    echo Ejecuta "pnpm install" desde esta carpeta y vuelve a intentarlo.
    pause
    popd
    exit /b 1
)

start "TramitesDigitales - Web (3000)" cmd /k "%PNPM_CMD% --filter web dev"
start "TramitesDigitales - BFF (3001)" cmd /k "%PNPM_CMD% --filter bff dev"
start "TramitesDigitales - Remote (3002)" cmd /k "%PNPM_CMD% --filter form-remote dev"
start "TramitesDigitales - Dynamics Mock (3003)" cmd /k "%PNPM_CMD% --filter dynamics-mock dev"

echo Servidores iniciados en ventanas separadas.
echo Web: http://localhost:3000
echo BFF: http://localhost:3001
echo Remote: http://localhost:3002
echo Dynamics Mock: http://localhost:3003

popd
endlocal
