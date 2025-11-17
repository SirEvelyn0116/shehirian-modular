@echo off
REM Playwright Test Runner Script for Windows
REM Usage: run-tests.bat [options]

setlocal enabledelayedexpansion

set LOCAL_URL=http://localhost:8080
set PROD_URL=https://sirevelyn0116.github.io/shehirian-modular

echo.
echo ================================
echo    Playwright Test Runner
echo ================================
echo.

REM Check if npx is available
where npx >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: npx not found. Install Node.js first.
    exit /b 1
)

REM Parse arguments
set MODE=%1
if "%MODE%"=="" set MODE=prod

if "%MODE%"=="local" (
    echo Testing against: LOCAL [%LOCAL_URL%]
    set BASE_URL=%LOCAL_URL%
    goto :run_tests
)

if "%MODE%"=="prod" (
    echo Testing against: PRODUCTION [%PROD_URL%]
    set BASE_URL=%PROD_URL%
    goto :run_tests
)

if "%MODE%"=="headed" (
    echo Running in HEADED mode
    set BASE_URL=%PROD_URL%
    set EXTRA_ARGS=--headed
    goto :run_tests
)

if "%MODE%"=="debug" (
    echo Running in DEBUG mode
    set BASE_URL=%PROD_URL%
    set EXTRA_ARGS=--debug
    goto :run_tests
)

if "%MODE%"=="chromium" (
    echo Testing in: Chromium
    set BASE_URL=%PROD_URL%
    set EXTRA_ARGS=--project=chromium
    goto :run_tests
)

if "%MODE%"=="firefox" (
    echo Testing in: Firefox
    set BASE_URL=%PROD_URL%
    set EXTRA_ARGS=--project=firefox
    goto :run_tests
)

if "%MODE%"=="webkit" (
    echo Testing in: WebKit
    set BASE_URL=%PROD_URL%
    set EXTRA_ARGS=--project=webkit
    goto :run_tests
)

if "%MODE%"=="report" (
    echo Opening test report...
    npx playwright show-report test-results/html
    exit /b 0
)

echo Error: Unknown option: %MODE%
echo.
echo Usage: %0 [local^|prod^|headed^|debug^|chromium^|firefox^|webkit^|report]
exit /b 1

:run_tests
echo ================================
echo.
echo Running tests...
echo.

npx playwright test %EXTRA_ARGS%

if %errorlevel% equ 0 (
    echo.
    echo ================================
    echo    All tests passed!
    echo ================================
    echo.
    echo View report: npx playwright show-report test-results/html
    exit /b 0
) else (
    echo.
    echo ================================
    echo    Some tests failed!
    echo ================================
    echo.
    echo View report: npx playwright show-report test-results/html
    echo Debug: %0 debug
    exit /b 1
)
