@echo off

REM Start Apache (Hidden)
powershell -WindowStyle Hidden -Command "Start-Process 'C:\xampp\apache_start.bat' -WindowStyle Hidden"

REM Start MySQL (Hidden)
powershell -WindowStyle Hidden -Command "Start-Process 'C:\xampp\mysql_start.bat' -WindowStyle Hidden"

timeout /t 5 /nobreak >nul

REM Start Frontend (Hidden)
powershell -WindowStyle Hidden -Command "Start-Process cmd -ArgumentList '/c npm run dev' -WindowStyle Hidden"

REM Start API (Hidden)
powershell -WindowStyle Hidden -Command "Start-Process cmd -ArgumentList '/c npm run dev:api' -WindowStyle Hidden"

exit