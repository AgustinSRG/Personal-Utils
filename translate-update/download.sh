#!/bin/bash

# This file updates the Pokemon Showdown Data

node download.js -href https://play.pokemonshowdown.com/data/pokedex.js -o data/pokedex.js
node download.js -href https://play.pokemonshowdown.com/data/moves.js -o data/moves.js
node download.js -href https://play.pokemonshowdown.com/data/abilities.js -o data/abilities.js
node download.js -href https://play.pokemonshowdown.com/data/items.js -o data/items.js
