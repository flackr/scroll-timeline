@echo off
rem Configure command environment variables.
rem    config silent [runs silently]
rem    config [runs "verbosely", reporting on current settings]
rem Note that anything will match "silent"
if "%WPT_DIR%"=="" set WPT_DIR=test\wpt
if "%WPT_SERVER_PORT%"=="" set WPT_SERVER_PORT=8082
if "%WPT_SERVER_ADDRESS%"=="" set WPT_SERVER_ADDRESS=127.0.0.1
if "%LOCAL_BROWSER%"=="" set LOCAL_BROWSER=chrome
if "%LOCAL_WEBDRIVER_BIN%"=="" set LOCAL_WEBDRIVER_BIN=c:\src\src\out\default\chromedriver.exe
if NOT "%1"=="" goto END
echo Configured to run tests on %LOCAL_BROWSER% at http://%WPT_SERVER_ADDRESS%:%WPT_SERVER_PORT%
echo Tests will be served from %WPT_DIR% using %LOCAL_WEBDRIVER_BIN%
:END