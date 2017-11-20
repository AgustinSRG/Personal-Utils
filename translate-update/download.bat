@echo off
call node download.js -href https://raw.githubusercontent.com/Zarel/Pokemon-Showdown/master/data/pokedex.js -o data/pokedex.js
call node download.js -href https://raw.githubusercontent.com/Zarel/Pokemon-Showdown/master/data/moves.js -o data/moves.js
call node download.js -href https://raw.githubusercontent.com/Zarel/Pokemon-Showdown/master/data/abilities.js -o data/abilities.js
call node download.js -href https://raw.githubusercontent.com/Zarel/Pokemon-Showdown/master/data/items.js -o data/items.js
pause