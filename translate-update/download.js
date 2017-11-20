/* Download Tool */

'use strict';

const Https = require('https');
const Http = require('http');
const Url = require('url');

const FileSystem = require('fs');
const Path = require('path');

/**
 * Web-Get
 * This function downloads a file and returns the data
 * via the callback
 *
 * @param {String} url - The requested url
 * @param {function(String, Error)} callback
 */
function wget(url, callback) {
	url = Url.parse(url);
	let mod = url.protocol === 'https:' ? Https : Http;
	mod.get(url.href, response => {
		let data = '';
		response.on('data', chunk => {
			data += chunk;
		});
		response.on('end', () => {
			callback(data);
		});
		response.on('error', err => {
			callback(null, err);
		});
	}).on('error', err => {
		callback(null, err);
	});
}

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

let href = shellOpts['-href'];
let dest = shellOpts['-o'];
if (href && dest) {
	dest = Path.resolve(__dirname, dest);
	console.log('Downloading "' + href + '"...');
	wget(href, (data, err) => {
		if (err) {
			console.log("Error: " + err.code + " - " + err.message);
			process.exit(1);
		} else {
			FileSystem.writeFileSync(dest, data);
			console.log("Sucessfully downloaded the file: " + dest);
			process.exit(0);
		}
	});
} else {
	console.log("Usage: node download.js -href <url> -o <dest>");
	process.exit(1);
}
