@echo off
call node trans.js -t english-pokemon-trans.js --main
call node trans.js -t spanish-pokemon-trans.js
pause