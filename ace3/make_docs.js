"use strict"

const fs = require('fs');
const fs_path = require('path');
const parsers = require('../client/server/parsers/docstring');
const DocString = parsers.Docstring

let documentation = {};

const commentRe = /\/\*(.*?)\*\//ms
const starRe = /\n \* ?/mg

const authorRe = /Author:\s*(.*)/i
const argumentsRe = /Arguments:\s*\n(.*?)\n\s*\n/is
const argumentRe = /^([0-9]+)\:\s*(.*?)<([^>]*)>(?: \(default:\s*([^\)]*)\))?/gm
const returnsRe = /Return Value:\s*\n(.*?)\n\s*\n/is
const publicRe = /Public:\s*(.*)/i

function parseContents(fnc, contents) {
	let match = commentRe.exec(contents.replace(/\r/g, ''))

	if (match) {
		let contents = match[1]
			.replace(starRe, '\n')
			.replace(/ \* Author:/, 'Author:')

		let author = authorRe.exec(contents)
		let args = argumentsRe.exec(contents)
		let returns = returnsRe.exec(contents)
		let isPublic = publicRe.exec(contents)
		let lines = contents.split('\n')
		let desc = lines[2]
		let plainDesc = desc

		if (isPublic && isPublic[1].trim().toLowerCase() !== 'yes') {
			return
		}

		let params = []
		if (args) {
			while (match = argumentRe.exec(args[1])) {
				let arg = {
					type: match[3],
					description: match[2]
				}

				if (match[4] !== undefined) {
					arg.optional = true
					arg.default = match[4]
				}

				params.push(arg)
			}
		}

		if (params.length > 0) {
			desc +=
				"\r\n" +
				params
					.map((param, index) => {
						let def = param.optional ? ` (default: ${param.default})` : ''
						if (param.name)
							return `${index}. \`${param.name} (${param.type})\` - ${param.description}${def}`;
						return `${index}. \`${param.type}\` - ${param.description}${def}`;
					})
					.join("\r\n") + "\r\n\r\n";
		}

		let signature = `call ${fnc}`
		if (params.length > 0) {
			signature = "[" + params.map((param, index) => {
				let name = param.name || `_${param.type.toLowerCase()}${index}`;
				if (param.optional && param.default) {
					return `${name}=${param.default}`
				}

				return name;
			}).join(',') + "] call " + fnc;
		}

		documentation[fnc.toLowerCase()] = {
			type: "function",
			title: fnc,
			description: {
				plain: plainDesc,
				formatted: desc
			},
			signatures: [{
				returns: returns ? returns[1] : 'ANY',
				signature
			}]
		};
	} else {
		console.log('No comment in ' + fnc)
	}
}

/**
 * Tries to parse all sqf files in workspace.
 */
function loadFiles() {
	walkPath(__dirname + "/ACE3/addons/", (file, fnc) => {
		fs.readFile(file, (err, data) => {
			if (err) throw err;

			if (data) {
				parseContents(fnc, data.toString());
				saveDocs();
			}
		});
	});
}

function saveDocs() {
	fs.writeFile(__dirname + "/ace3.json", JSON.stringify(documentation), (err) => {
		if (err) throw err;
	});
}

/**
 * Walks specified path while calling callback for each sqf file found.
 */
function walkPath(path, callback) {
	try {
		fs.readdir(path, (err, files) => {
			if (err) throw err

			files.forEach(addon => {
				let addonDir = fs_path.join(path, addon, 'functions')
				fs.readdir(addonDir, (err, files) => {
					if (err) {
						console.log(`No functions for ${addon}`)
						console.log(err.toString())
						return
					}

					files.forEach(func => {
						if (fs_path.extname(func).toLowerCase() === '.sqf') {
							callback(fs_path.join(addonDir, func), `ACE_${addon}_${func.split('.').slice(0, -1).join('.')}`)
						}
					})
				})
			})
		})
	} finally {

	}
}


loadFiles();