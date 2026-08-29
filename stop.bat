@echo off

echo Stopping Apache...
taskkill /F /IM httpd.exe >nul 2>&1

echo Stopping MySQL...
taskkill /F /IM mysqld.exe >nul 2>&1

echo Stopping Node.js...
taskkill /F /IM node.exe >nul 2>&1

echo Stopping CMD windows...
taskkill /F /IM cmd.exe >nul 2>&1

echo Done.
pause