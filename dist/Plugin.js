"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistentQueue = void 0;
const erela_js_1 = require("erela.js");
const mongodb_1 = require("mongodb");
const discord_js_1 = require("discord.js");
const check = (options) => {
    if (!options) {
        throw new TypeError("PluginOptions must not be empty.");
    }
    if (typeof options.mongoDbUrl !== "string") {
        throw new TypeError('Plugin option "mongoDbUrl" must be present and be a non-empty string.');
    }
};
class persistentQueue extends erela_js_1.Plugin {
    constructor(client, options) {
        super();
        check(options);
        this.options = Object.assign({}, options);
        this.client = client;
        this.connectDB();
    }
    load(manager) {
        this.manager = manager;
        this.manager
            .on("nodeRaw", (payload) => {
            if (payload.op === "playerUpdate") {
                const player = this.manager.players.get(payload.guildId);
                if (player) {
                    const collection = this.Db.collection("persistentQueue");
                    collection.updateOne({
                        id: player.guild,
                    }, {
                        $set: {
                            queue: player.queue,
                            current: player.queue.current,
                            queueRepeat: player.queueRepeat,
                            trackRepeat: player.trackRepeat,
                            filters: player.filters,
                            textChannel: player.textChannel,
                            voiceChannel: player.voiceChannel,
                            voiceState: player.voiceState,
                            volume: player.volume,
                            position: payload.state.position || 0,
                        },
                    }, {
                        upsert: true,
                    });
                    player.position = payload.state.position || 0;
                }
            }
        })
            .on("playerDestroy", (player) => {
            const collection = this.Db.collection("persistentQueue");
            collection.deleteOne({ id: player.guild });
        })
            .on("queueEnd", (player) => {
            const collection = this.Db.collection("persistentQueue");
            collection.updateOne({
                id: player.guild,
            }, {
                $set: {
                    queue: player.queue,
                    current: player.queue.current,
                    position: 0,
                },
            }, {
                upsert: true,
            });
        });
        // @ts-ignore
        (() => __awaiter(this, void 0, void 0, function* () {
            var _a;
            yield this.delay((_a = this.options.delay) !== null && _a !== void 0 ? _a : 2000);
            const database = (yield this.Db.collection("persistentQueue")
                .find({})
                .toArray());
            database.forEach((db) => {
                var _a;
                if (!db.voiceChannel ||
                    !db.textChannel ||
                    !db.id ||
                    !db.current ||
                    !this.client.channels.cache.get(db.voiceChannel) ||
                    !this.client.channels.cache.get(db.textChannel))
                    return;
                const player = this.manager.create({
                    voiceChannel: db.voiceChannel,
                    textChannel: db.textChannel,
                    guild: db.id,
                });
                player.connect();
                if (db.current)
                    player.queue.add(erela_js_1.TrackUtils.buildUnresolved({
                        title: db.current.title,
                        author: db.current.author,
                        duration: db.current.duration,
                    }, new discord_js_1.User(this.client, db.current.requester)));
                for (let track of db.queue) {
                    player.queue.add(erela_js_1.TrackUtils.buildUnresolved({
                        title: track.title,
                        author: track.author,
                        duration: track.duration,
                    }, new discord_js_1.User(this.client, db.current.requester)));
                }
                if (db.trackRepeat)
                    player.setTrackRepeat(true);
                if (db.queueRepeat)
                    player.setQueueRepeat(true);
                if (Object.keys(db.filters).length > 0) {
                    player.setFilters("filters", db.filters);
                }
                player.play(erela_js_1.TrackUtils.buildUnresolved(player.queue.current, new discord_js_1.User(this.client, db.current.requester)), { startTime: (_a = db.position) !== null && _a !== void 0 ? _a : 0 });
            });
        }))();
    }
    delay(delayInms) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(2);
            }, delayInms);
        });
    }
    connectDB() {
        return __awaiter(this, void 0, void 0, function* () {
            const client = new mongodb_1.MongoClient(this.options.mongoDbUrl);
            this.clientDb = client;
            yield client.connect();
            this.Db = client.db(this.options.mongoDbName || "erelaQueue");
        });
    }
}
exports.persistentQueue = persistentQueue;
