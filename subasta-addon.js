/**
 * Subasta de jugadores para Showdown-ChatBot
 * Install as an Add-On
 */

'use strict';

const Path = require('path');
const DataBase = Tools('json-db');
const Text = Tools('text');
const Chat = Tools('chat');
const LineSplitter = Tools('line-splitter');

let auction = null;

class PlayersAuction {
	constructor(App) {
		this.app = App;
		this.db = new DataBase(Path.resolve(App.confDir, "datos-subasta.json"));
		this.data = this.db.data;
		if (!this.data.room) this.data.room = "subasta";
		if (!this.data.timer) this.data.timer = (30 * 1000);
		if (!this.data.mincost) this.data.mincost = 4;
		if (!this.data.minplayers) this.data.minplayers = 0;
		if (!this.data.teams) this.data.teams = {};
		if (!this.data.players) this.data.players = {};
		if (!this.data.turn) this.data.turn = "";

		this.status = "paused";
		this.timer = null;
		this.nominated = null;
		this.nominatedTeam = null;
		this.nominatedCost = 0;
	}

	send(text) {
		this.app.bot.sendTo(this.data.room, text);
	}

	addPlayer(name) {
		let id = Text.toId(name);
		if (id && !this.data.players[id]) {
			this.data.players[id] = {
				id: id,
				name: name,
				team: null,
				cost: 0,
			};
			return true;
		} else {
			return false;
		}
	}

	removePlayer(id) {
		if (this.data.players[id]) {
			delete this.data.players[id];
			return true;
		} else {
			return false;
		}
	}

	getPlayer(dirty) {
		let id = Text.toId(dirty);
		return this.data.players[id];
	}

	addTeam(name) {
		let id = Text.toId(name);
		if (id && id.length < 20 && !this.data.teams[id]) {
			this.data.teams[id] = {
				id: id,
				name: name,
				money: 0,
				captain: "",
				subcaptain: "",
			};
			return true;
		} else {
			return false;
		}
	}

	removeTeam(id) {
		if (this.data.teams[id]) {
			for (let player in this.data.players) {
				if (this.data.players[player].team === id) {
					this.setFreePlayer(this.data.players[player]);
				}
			}
			if (this.data.turn === id) this.data.turn = "";
			delete this.data.teams[id];
			return true;
		} else {
			return false;
		}
	}

	getTeam(dirty) {
		let id = Text.toId(dirty);
		return this.data.teams[id];
	}

	getTeamByMember(userid) {
		for (let team in this.data.teams) {
			if (this.data.teams[team].captain === userid || this.data.teams[team].subcaptain === userid) {
				return this.data.teams[team];
			}
		}
		return null;
	}

	setPlayerToTeam(player, team, cost) {
		player.team = team.id;
		player.cost = cost;
	}

	setFreePlayer(player) {
		if (player.team) {
			let team = this.getTeam(player.team);
			if (team) team.money += player.cost;
		}
		player.team = null;
		player.cost = 0;
	}

	/* Active */

	setTurn(team) {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.data.turn = team.id;
		this.status = "paused";
	}

	setNextTurn() {
		let teams = Object.keys(this.data.teams);
		if (teams.length === 0) return;
		if (teams.length === 1) {
			this.setTurn(this.data.teams[teams[0]]);
		} else {
			let i = teams.indexOf(this.data.turn);
			if (i === -1) {
				this.setTurn(this.data.teams[teams[0]]);
			} else if (i >= (teams.length - 1)) {
				this.setTurn(this.data.teams[teams[0]]);
			} else {
				this.setTurn(this.data.teams[teams[i + 1]]);
			}
		}
		this.send("El equipo " + Chat.bold(this.getTeam(auction.data.turn).name) + " tiene el turno para nominar. El capitan o sub-capitan debe usar ``.nominar <jugador>`` o bien ``.pasarturno``");
	}

	nominate(player, team) {
		if (this.status !== "paused") return;
		this.nominated = player;
		this.nominatedCost = this.data.mincost;
		this.nominatedTeam = team;
		this.status = "nominated";
		this.timer = setTimeout(this.timeout.bind(this), this.data.timer);
	}

	playersForTeam(team) {
		let players = [];
		for (let player in this.data.players) {
			if (this.data.players[player].team === team.id) players.push(this.data.players[player]);
		}
		return players;
	}

	getFreePlayers() {
		let players = [];
		for (let player in this.data.players) {
			if (!this.data.players[player].team) players.push(this.data.players[player]);
		}
		return players;
	}

	bid(team, cost) {
		if (this.status !== "nominated") return false;
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.nominatedCost = cost;
		this.nominatedTeam = team;
		this.timer = setTimeout(this.timeout.bind(this), this.data.timer);
		return true;
	}

	timeout(forced) {
		if (this.status !== "nominated") return;
		this.status = "paused";
		if (this.timer && forced) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.timer = null;
		this.setPlayerToTeam(this.nominated, this.nominatedTeam, this.nominatedCost);
		this.nominatedTeam.money -= this.nominatedCost;

		if (!forced) {
			this.send("**¡El Tiempo ha terminado!** El jugador " + Chat.italics(this.nominated.name) + " es asignado al equipo " + Chat.italics(this.nominatedTeam.name) + " por " + Chat.italics(this.nominatedCost) + "K");
		} else {
			this.send("**¡El Puja ha finalizado!** El jugador " + Chat.italics(this.nominated.name) + " es asignado al equipo " + Chat.italics(this.nominatedTeam.name) + " por " + Chat.italics(this.nominatedCost) + "K");
		}

		this.nominated = null;
		this.setNextTurn();
		this.db.write();
	}

	destroy() {
		this.db.destroy();
	}
}

const commands = {
	subasta: function (App) {
		if (!this.can('subasta', this.room)) return this.replyAccessDenied('subasta');
		if (auction.status !== "paused") {
			return this.errorReply("No puedes configurar la subasta mientras se está pujando.");
		}
		let opt = Text.toId(this.args[0]);
		let teamId, team, money, players, time, id, player;
		switch (opt) {
		case "setroom":
			let room = Text.toRoomid(this.args[1]);
			if (!room) return this.errorReply(this.usage({desc: "setroom", optional: true}, {desc: "sala"}));
			auction.data.room = room;
			this.reply("Sala para subastas estabecida a " + Chat.italics(room));
			auction.db.write();
			break;
		case "setturn":
			teamId = Text.toId(this.args[1]);
			if (!teamId) return this.errorReply(this.usage({desc: "setturn", optional: true}, {desc: "equipo"}));
			team = auction.getTeam(teamId);
			if (!team) return this.errorReply("El equipo " + Chat.italics(teamId) + " no está registrado en la subasta");
			auction.setTurn(team);
			this.reply("El tuno ahora lo tiene el equipo " + Chat.italics(team.name));
			auction.db.write();
			break;
		case "setminmoney":
			money = parseFloat(this.args[1]);
			if (isNaN(money) || money < 0) return this.errorReply(this.usage({desc: "setminmoney", optional: true}, {desc: "dinero (K)"}));
			if ((money * 10) % 5 !== 0) return this.errorReply("El dinero debe ser entero o divisor de 0.5 K, no se admiten otros valores decimales.");
			auction.data.mincost = money;
			this.reply("El precio minimo de un jugador ahora es de " + Chat.italics(money + " K"));
			auction.db.write();
			break;
		case "setminplayers":
			players = parseInt(this.args[1]);
			if (isNaN(players) || players < 0) return this.errorReply(this.usage({desc: "setminplayers", optional: true}, {desc: "numero de jugadores"}));
			auction.data.minplayers = players;
			this.reply("El numero minimo de jugadores que un equipo debe tener es de " + Chat.italics(players));
			auction.db.write();
			break;
		case "settimer":
			time = parseInt(this.args[1]);
			if (isNaN(time) || time < 0) return this.errorReply(this.usage({desc: "settimer", optional: true}, {desc: "segundos"}));
			if (time < 10) return this.errorReply("El tiempo debe ser igual o mayor a 10 segundos para que de tiempo a pujar.");
			auction.data.timer = time * 1000;
			this.reply("El tiempo de puja ahora es de " + Chat.italics(time + " segundos"));
			auction.db.write();
			break;
		case "addteam":
			team = Text.trim(this.args[1]);
			if (!team || !Text.toId(team)) return this.errorReply(this.usage({desc: "addteam", optional: true}, {desc: "nombre"}));
			if (auction.addTeam(team)) {
				this.reply("Nuevo equipo en la subasta: " + team);
				auction.db.write();
			} else {
				this.errorReply("El equipo que intenta incluir en la subasta ya existe.");
			}
			break;
		case "setmoney":
			teamId = Text.toId(this.args[1]);
			money = parseFloat(this.args[2]);
			if (!teamId || isNaN(money) || money < 0) {
				return this.errorReply(this.usage({desc: "setmoney", optional: true}, {desc: "equipo"}, {desc: "dinero (K)"}));
			}
			if ((money * 10) % 5 !== 0) return this.errorReply("El dinero debe ser entero o divisor de 0.5 K, no se admiten otros valores decimales.");
			team = auction.getTeam(teamId);
			if (!team) return this.errorReply("El equipo " + Chat.italics(teamId) + " no esta registrado en la subasta");
			team.money = money;
			this.reply("El dinero del equipo " + Chat.italics(team.name) + " ahora es de " + Chat.italics(money + " K"));
			auction.db.write();
			break;
		case "setcaptain":
			teamId = Text.toId(this.args[1]);
			id = Text.toId(this.args[2]);
			if (!teamId || !id) return this.errorReply(this.usage({desc: "setcaptain", optional: true}, {desc: "equipo"}, {desc: "capitan"}));
			team = auction.getTeam(teamId);
			if (!team) return this.errorReply("El equipo " + Chat.italics(teamId) + " no esta registrado en la subasta");
			team.captain = id;
			this.reply("El capitan del equipo " + Chat.italics(team.name) + " ahora es " + Chat.italics(id));
			auction.db.write();
			break;
		case "setsubcaptain":
			teamId = Text.toId(this.args[1]);
			id = Text.toId(this.args[2]);
			if (!teamId || !id) return this.errorReply(this.usage({desc: "setsubcaptain", optional: true}, {desc: "equipo"}, {desc: "sub-capitan"}));
			team = auction.getTeam(teamId);
			if (!team) return this.errorReply("El equipo " + Chat.italics(teamId) + " no esta registrado en la subasta");
			team.subcaptain = id;
			this.reply("El sub-capitan del equipo " + Chat.italics(team.name) + " ahora es " + Chat.italics(id));
			auction.db.write();
			break;
		case "rmteam":
			team = Text.toId(this.args[1]);
			if (!team) return this.errorReply(this.usage({desc: "rmteam", optional: true}, {desc: "equipo"}));
			if (auction.removeTeam(team)) {
				this.reply("Eliminado equipo de la subasta: " + team);
				auction.db.write();
			} else {
				this.errorReply("El equipo que intenta eliminar no está registrado en la subasta.");
			}
			break;
		case "addplayers":
			if (this.args.length < 2) {
				return this.errorReply(this.usage({desc: "addplayers", optional: true}, {desc: "jugador"}, {desc: "...", optional: true}));
			}
			players = [];
			for (let i = 1; i < this.args.length; i++) {
				player = Text.trim(this.args[i]);
				if (auction.addPlayer(player)) {
					players.push(player);
				}
			}
			if (players.length) {
				this.reply("Jugadores registrados: " + players.join(', '));
				auction.db.write();
			} else {
				this.errorReply("Los jugadores especificados tenían nicks no validos o ya estaban registrados en la subasta");
			}
			break;
		case "rmplayers":
			if (this.args.length < 2) {
				return this.errorReply(this.usage({desc: "rmplayers", optional: true}, {desc: "jugador"}, {desc: "...", optional: true}));
			}
			players = [];
			for (let i = 1; i < this.args.length; i++) {
				player = Text.trim(this.args[i]);
				if (auction.removePlayer(player)) {
					players.push(player);
				}
			}
			if (players.length) {
				this.reply("Jugadores eliminados: " + players.join(', '));
				auction.db.write();
			} else {
				this.errorReply("Los jugadores especificados tenían nicks no validos o no estaban registrados en la subasta");
			}
			break;
		case "teamplayer":
			teamId = Text.toId(this.args[1]);
			id = Text.toId(this.args[2]);
			money = parseFloat(this.args[3]);
			if (!teamId || !id || isNaN(money) || money < 0) return this.errorReply(this.usage({desc: "teamplayer", optional: true}, {desc: "equipo"}, {desc: "jugador"}, {desc: "coste"}));
			if ((money * 10) % 5 !== 0) return this.errorReply("El dinero debe ser entero o divisor de 0.5 K, no se admiten otros valores decimales.");
			team = auction.getTeam(teamId);
			if (!team) return this.errorReply("El equipo " + Chat.italics(teamId) + " no esta registrado en la subasta");
			player = auction.getPlayer(id);
			if (!player) return this.errorReply("El jugador " + Chat.italics(id) + " no esta registrado en la subasta");
			auction.setPlayerToTeam(player, team, money);
			team.money -= money;
			if (team.money < 0) team.money = 0;
			this.reply("El jugador " + Chat.italics(player.name) + " es asignado al equipo " + Chat.italics(team.name) + " por " + Chat.italics(money + " K"));
			auction.db.write();
			break;
		case "freeplayer":
			id = Text.toId(this.args[1]);
			if (!id) return this.errorReply(this.usage({desc: "freeplayer", optional: true}, {desc: "jugador"}));
			player = auction.getPlayer(id);
			if (!player) return this.errorReply("El jugador " + Chat.italics(id) + " no esta registrado en la subasta");
			auction.setFreePlayer(player);
			this.reply("El jugador " + Chat.italics(player.name) + " ya no tiene equipo y puede ser nominado");
			auction.db.write();
			break;
		default:
			return this.errorReply(this.usage({desc: "setroom | setturn | setminmoney | setminplayers | settimer | addteam | setcaptain | setsubcaptain | rmteam | addplayers | rmplayers | setmoney | teamplayer | freeplayer"}));
		}
		this.addToSecurityLog();
	},

	turnosubasta: function (App) {
		if (this.room !== auction.data.room) return this.errorReply("Este comando solo puede ser usado en la sala para subastas.");
		if (auction.status === "paused") {
			if (auction.data.turn) {
				this.restrictReply("El equipo " + Chat.bold(auction.getTeam(auction.data.turn).name) + " tiene el turno para nominar. El capitan o sub-capitan debe usar ``.nominar <jugador>`` o bien ``.pasarturno``", "info");
			} else {
				this.restrictReply("No hay un turno establecido. Usa el comando ``.subasta setturn, <equipo>`` para establecerlo", "info");
			}
		} else if (auction.status === "nominated") {
			this.restrictReply("Nominado el jugador " + Chat.bold(auction.nominated.name) + " | Equipo " + Chat.italics(auction.nominatedTeam.name) + " por " + Chat.italics(auction.nominatedCost + " K") + " | Usa ``.pujar <cantidad>`` para pujar más alto.", "info");
		}
	},

	equiposubasta: function (App) {
		if (this.room !== auction.data.room) return this.errorReply("Este comando solo puede ser usado en la sala para subastas.");
		let teamId = Text.toId(this.arg);
		if (!teamId) return this.errorReply(this.usage({desc: 'equipo'}));
		let team = auction.getTeam(teamId);
		if (!team) return this.errorReply("El equipo " + Chat.italics(teamId) + " no esta registrado en la subasta");
		let spl = new LineSplitter(App.config.bot.maxMessageLength);
		spl.add(Chat.bold(team.name) + " | " + team.money + " K | Capitan: " + (team.captain || '-') +
			" | Sub-Capitan: " + (team.subcaptain || '-') + " | Jugadores:");
		let players = auction.playersForTeam(team);
		if (players.length === 0) {
			spl.add(" __(ninguno)__");
		} else {
			for (let i = 0; i < players.length; i++) {
				let player = players[i];
				spl.add(Chat.bold(player.name) + " (" + player.cost + " K" + ")" + (i < players.length - 1 ? ", " : ""));
			}
		}
		return this.restrictReply(spl.getLines(), 'info');
	},

	jugadoressubasta: function (App) {
		if (this.room !== auction.data.room) return this.errorReply("Este comando solo puede ser usado en la sala para subastas.");
		let spl = new LineSplitter(App.config.bot.maxMessageLength);
		spl.add(Chat.bold("Jugadores de la Subasta:"));
		let players = Object.values(auction.data.players);
		if (players.length === 0) return this.restrictReply("No hay jugadores en la subasta", "info");
		for (let i = 0; i < players.length; i++) {
			spl.add(" " + players[i].name + (i < (players.length - 1) ? ',' : ''));
		}
		return this.restrictReply(spl.getLines(), 'info');
	},

	jugadoreslibres: function (App) {
		if (this.room !== auction.data.room) return this.errorReply("Este comando solo puede ser usado en la sala para subastas.");
		let spl = new LineSplitter(App.config.bot.maxMessageLength);
		spl.add(Chat.bold("Jugadores sin equipo:"));
		let players = Object.values(auction.data.players);
		let empty = true;
		for (let i = 0; i < players.length; i++) {
			if (players[i].team) continue;
			empty = false;
			spl.add(" " + players[i].name + (i < (players.length - 1) ? ',' : ''));
		}
		if (empty) return this.restrictReply("No hay jugadores sin equipo", "info");
		return this.restrictReply(spl.getLines(), 'info');
	},

	listaequipos: function (App) {
		if (this.room !== auction.data.room) return this.errorReply("Este comando solo puede ser usado en la sala para subastas.");
		let spl = new LineSplitter(App.config.bot.maxMessageLength);
		spl.add(Chat.bold("Equipos de la Subasta:"));
		let teams = Object.values(auction.data.teams);
		if (teams.length === 0) return this.restrictReply("No hay equipos registrados en la subasta", "info");
		for (let i = 0; i < teams.length; i++) {
			spl.add(" " + teams[i].name + (i < (teams.length - 1) ? ',' : ''));
		}
		return this.restrictReply(spl.getLines(), 'info');
	},

	nominar: function (App) {
		if (this.room !== auction.data.room) return this.errorReply("Este comando solo puede ser usado en la sala para subastas.");
		if (auction.status === "paused" && auction.data.turn) {
			let team = auction.getTeam(auction.data.turn);
			if (!team || team.captain === this.byIdent.id || team.subcaptain === this.byIdent.id) {
				if (team.money < auction.data.mincost) return this.errorReply("Tu equipo no tiene suficiente dinero para pujar a " + auction.data.mincost + " K");
				let playerId = Text.toId(this.arg);
				if (!playerId) return this.errorReply(this.usage({desc: "jugador"}));
				let player = auction.getPlayer(playerId);
				if (!player) return this.errorReply("El jugador " + Chat.italics(playerId) + " no esta registrado en la subasta");
				if (player.team) return this.errorReply("El jugador " + Chat.italics(playerId) + " ya es miembro de un equipo");
				auction.nominate(player, team);
				this.reply("Nominado el jugador " + Chat.bold(auction.nominated.name) + " | Equipo " + Chat.italics(auction.nominatedTeam.name) + " por " + Chat.italics(auction.nominatedCost + " K") + " | Usa ``.pujar <cantidad>`` para pujar más alto. El tiempo para pujar es de " + Math.floor(auction.data.timer / 1000) + " segundos.");
			} else {
				this.pmReply("No eres el capitan ni el subcapitan del equipo " + Chat.italics(team.name));
			}
		} else {
			this.pmReply("No puedes hacer esto cuando hay una puja en marcha");
		}
	},

	pasarturno: function (App) {
		if (this.room !== auction.data.room) return this.errorReply("Este comando solo puede ser usado en la sala para subastas.");
		if (auction.status === "paused" && auction.data.turn) {
			let team = auction.getTeam(auction.data.turn);
			if (!team || team.captain === this.byIdent.id || team.subcaptain === this.byIdent.id) {
				auction.setNextTurn();
				auction.db.write();
			} else {
				this.pmReply("No eres el capitan ni el subcapitan del equipo " + Chat.italics(team.name));
			}
		} else {
			this.pmReply("No puedes hacer esto cuando hay una puja en marcha");
		}
	},

	pujar: function (App) {
		if (this.room !== auction.data.room) return this.errorReply("Este comando solo puede ser usado en la sala para subastas.");
		if (auction.status === "nominated") {
			let team = auction.getTeamByMember(this.byIdent.id);
			if (team) {
				if (team.id !== auction.nominatedTeam.id) {
					let money = auction.nominatedCost + 0.5;
					if (this.arg) {
						money = parseFloat(this.arg);
					}
					if (isNaN(money) || money < 0) return this.pmReply(this.usage({desc: "dinero (K)", optional: true}));
					if ((money * 10) % 5 !== 0) return this.pmReply("El dinero debe ser entero o divisor de 0.5 K, no se admiten otros valores decimales.");
					if (team.money < money) return this.pmReply("Tu equipo no tiene suficiente dinero para pujar a " + money + " K");
					if (team.money - money < ((auction.data.minplayers - auction.playersForTeam(team).length - 1) * auction.data.mincost)) {
						return this.pmReply("A tu equipo aun le faltan jugadores. No puedes pujar tan alto.");
					}
					if (money <= auction.nominatedCost) return this.pmReply("La puja debe ser mayor a la puja actual.");
					auction.bid(team, money);
					this.reply("El equipo " + Chat.bold(auction.nominatedTeam.name) + " puja " + Chat.bold(auction.nominatedCost + " K") + " por " + Chat.bold(auction.nominated.name) + " | Usa ``.pujar <cantidad>`` para pujar más alto. El tiempo para pujar es de " + Math.floor(auction.data.timer / 1000) + " segundos.");
				} else {
					this.pmReply("Ya tenias la puja más alta.");
				}
			} else {
				this.pmReply("No formas parte de ningun equipo de la subasta");
			}
		} else {
			this.errorReply("No hay ningún jugador nominado");
		}
	},

	finpuja: function (App) {
		if (this.room !== auction.data.room) return this.errorReply("Este comando solo puede ser usado en la sala para subastas.");
		if (!this.can('subasta', this.room)) return this.replyAccessDenied('subasta');
		if (auction.status === "nominated") {
			auction.timeout(true);
		} else {
			this.errorReply("No hay ningún jugador nominado");
		}
	},

	informesubasta: function (App) {
		if (!this.can('subasta', this.room)) return this.replyAccessDenied('subasta');
		let server = App.config.server.url;
		if (!server) {
			return this.errorReply("Fallo en la configuracion.");
		}
		let html = '<html>';
		html += '<head><title>Subasta de Jugadores</title><style type="text/css">p {padding:5px;} td {padding:5px;}</style></head>';
		html += '<body>';
		html += '<h2 align="center">Subasta de Jugadores</h2>';
		html += '<h3>Configuracion</h3>';
		html += '<p>- <strong>Sala:</strong> ' + Text.escapeHTML(auction.data.room) + '</p>';
		html += '<p>- <strong>Coste minimo:</strong> ' + Text.escapeHTML(auction.data.mincost || "0") + ' K</p>';
		html += '<p>- <strong>Jugadores necesarios por equipo:</strong> ' + Text.escapeHTML(auction.data.minplayers) + '</p>';
		html += '<p> - <strong>Tiempo para subir la puja:</strong> ' + Text.escapeHTML(Math.floor(auction.data.timer / 1000)) + ' segundos</p>';
		html += '<h3>Equipos</h3>';
		for (let id in auction.data.teams) {
			let team = auction.data.teams[id];
			html += '<table width="100%" border="1">';
			html += '<tr><td width="139px"><strong>Nombre</strong></td><td>' + Text.escapeHTML(team.name) + '</td></tr>';
			html += '<tr><td><strong>Dinero</strong></td><td>' + Text.escapeHTML(team.money || "0") + ' K</td></tr>';
			html += '<tr><td><strong>Capitan</strong></td><td>' + Text.escapeHTML(team.captain || "-") + '</td></tr>';
			html += '<tr><td><strong>Sub-Capitan</strong></td><td>' + Text.escapeHTML(team.subcaptain || "-") + '</td></tr>';
			let playersTeam = auction.playersForTeam(team).map(player => ("<strong>" + Text.escapeHTML(player.name) + "</strong> (" + player.cost + " K)"));
			html += '<tr><td colspan="2">' + (playersTeam.join('<br />') || "-") + '</td></tr>';
			html += '</table>';
			html += '<br /><br />';
		}
		html += '<h3>Jugadores sin equipo</h3>';
		let freePlayers = auction.getFreePlayers().map(player => player.name);
		html += '<p>' + Text.escapeHTML(freePlayers.join(', ') || "(Ninguno)") + '</p>';
		html += '</body>';
		html += '</html>';
		let key = App.data.temp.createTempFile(html);
		if (server.charAt(server.length - 1) === '/') {
			return this.pmReply(App.config.server.url + 'temp/' + key);
		} else {
			return this.pmReply(App.config.server.url + '/temp/' + key);
		}
	},
};

exports.setup = function (App) {
	App.parser.addPermission('subasta', {excepted: true});
	auction = new PlayersAuction(App);
	App.parser.addCommands(commands);
};

exports.destroy = function (App) {
	App.parser.removeCommands(commands);
	delete App.parser.modPermissions['subasta'];
};
