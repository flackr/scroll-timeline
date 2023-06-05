rem #!/bin/bash

rem PROJ_DIR="$(cd "$(dirname "$1")" && pwd)"

rem WPT_DIR="$PROJ_DIR/test/wpt"

rem # if directory does not exist, clone fresh-stuff from WPT master
rem if [ ! -d "$WPT_DIR" ]; then
rem   echo "WPT folder not found, cloning from remote..."
rem   git clone https://github.com/web-platform-tests/wpt $WPT_DIR
rem else
rem   # ask git to attempt to rebase our changes on top of remote
rem   git -C "$WPT_DIR" pull --ff-only
rem fi

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