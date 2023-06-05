rem Batch file version of wpt-repo.sh

set PROJ_DIR=%CD%
set WPT_DIR=%PROJ_DIR%\test\wpt

if exist %WPT_DIR%\. goto UPDATE_CONTENT
echo dir not found.  Creating
git clone https://github.com/web-platform-tests/wpt %WPT_DIR%
goto :END

:UPDATE_CONTENT
echo updating content
git -C %WPT_DIR% pull --ff-only
:END