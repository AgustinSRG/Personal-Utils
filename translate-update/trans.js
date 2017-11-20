/**
 * Translations updater for Showdown ChatBot 
 *
 * This script checks the poke-stuff translations files
 * used by the "pokemon" module and add completes them
 *
 * @author Agustín San Román
 * @license MIT LICENSE
 */

'use strict';


const FileSystem = require('fs');
const Path = require('path');

let shellOpts = {};
for (let i = 0; i < process.argv.length; i++) {
	let tag = process.argv[i].trim();
	if (tag.charAt(0) === '-') {
		if (process.argv[i + 1]) {
			shellOpts[tag] = process.argv[i + 1];
		} else if (tag.length > 1 && tag.charAt(1) === '-') {
			shellOpts[tag] = true;
		}
	}
}

let target = shellOpts['-t'];
if (!target) {
	console.log("Usage: node trans.js -t <target-file>");
	process.exit(1);
}

console.log("Loading resources...");

const Pokedex = require(Path.resolve(__dirname, 'data/pokedex.js')).BattlePokedex;
const Moves = require(Path.resolve(__dirname, 'data/moves.js')).BattleMovedex;
const Items = require(Path.resolve(__dirname, 'data/items.js')).BattleItems;
const Abilities = require(Path.resolve(__dirname, 'data/abilities.js')).BattleAbilities;

let content = '';
let mod = null;

console.log("Parsing file...");

try {
	content = FileSystem.readFileSync(Path.resolve(__dirname, target)).toString();
	mod = require(Path.resolve(__dirname, target));
} catch (err) {
	console.log("Error: " + err.code + " - " + err.message);
	process.exit(1);
}

let originalLines = content.split('\n');
let resultLines = [];

for (let pokemon in mod.translations.pokemon) {
	delete Pokedex[pokemon];
}

for (let move in mod.translations.moves) {
	delete Moves[move];
}

for (let _item in mod.translations.items) {
	delete Items[_item];
}

for (let abilities in mod.translations.abilities) {
	delete Abilities[abilities];
}

function generate_line (id, name) {
	return ('\t"' + id + '": "' + (shellOpts['--main'] ? (name || '') : '') + '",');
}

let status = '';
for (let origin_line of originalLines) {
	switch (origin_line.trim()) {
		case 'exports.translations.pokemon = {':
			status = 'pokemon';
			break;
		case 'exports.translations.moves = {':
			status = 'moves';
			break;
		case 'exports.translations.items = {':
			status = 'items';
			break;
		case 'exports.translations.abilities = {':
			status = 'abilities';
			break;
		case '};':
			switch (status) {
				case 'pokemon':
					for (let key in Pokedex) {
						resultLines.push(generate_line(key, Pokedex[key].species));
						console.log("Missed Pokemon in translations: " + Pokedex[key].species);
					}
					break;
				case 'moves':
					for (let key in Moves) {
						resultLines.push(generate_line(key, Moves[key].name));
						console.log("Missed Move in translations: " + Moves[key].name);
					}
					break;
				case 'items':
					for (let key in Items) {
						resultLines.push(generate_line(key, Items[key].name));
						console.log("Missed Item in translations: " + Items[key].name);
					}
					break;
				case 'abilities':
					for (let key in Abilities) {
						resultLines.push(generate_line(key, Abilities[key].name));
						console.log("Missed Ability in translations: " + Abilities[key].name);
					}
					break;
			}
			status = '';
			break;
	}
	resultLines.push(origin_line);
}

try {
	FileSystem.writeFileSync(Path.resolve(__dirname, target), resultLines.join('\n'));
} catch (err) {
	console.log("Error: " + err.code + " - " + err.message);
	process.exit(1);
}

console.log('Completed');
process.exit(0);
