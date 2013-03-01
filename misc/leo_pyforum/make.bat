REM @+leo-ver=5-thin
REM @+node:myleobook1.20130228000334.12303: * @file make.bat
REM @@language batch
if "%1" == "" goto help

if "%1" == "help" (
	:help
	echo.Please use `make ^<target^>` where ^<target^> is one of
	echo.pyforum  to execute pyforum.py
        goto end
)

if "%1" == "pyforum" (
	V:\SciTE\python pyforum.py
	goto end
)

:end
REM @-leo
