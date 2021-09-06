import { Manager, Plugin, TrackUtils } from "erela.js";
import { PluginOptions } from "./typings";
import { Db, MongoClient } from "mongodb";
import { Client, User } from "discord.js";
const check = (options: PluginOptions) => {
  if (!options) {
    throw new TypeError("PluginOptions must not be empty.");
  }

  if (typeof options.mongoDbUrl !== "string") {
    throw new TypeError(
      'Plugin option "mongoDbUrl" must be present and be a non-empty string.'
    );
  }
};

export class persistentQueue extends Plugin {
  private readonly options: PluginOptions;
  private Db!: Db;
  private clientDb!: MongoClient;
  private client!: Client;
  public manager!: Manager;
  constructor(client: Client, options: PluginOptions) {
    super();
    check(options);
    this.options = {
      ...options,
    };
    this.client = client;
    this.connectDB();
  }

  public load(manager: Manager) {
    this.manager = manager;
    this.manager
      .on("nodeRaw", (payload: any) => {
        if (payload.op === "playerUpdate") {
          const player = this.manager.players.get(payload.guildId);
          if (player) {
            const collection = this.Db.collection("persistentQueue");
            collection.updateOne(
              {
                id: player.guild,
              },
              {
                $set: {
                  queue: player.queue,
                  current: player.queue.current,
                  queueRepeat: player.queueRepeat,
                  trackRepeat: player.trackRepeat,
                  textChannel: player.textChannel,
                  voiceChannel: player.voiceChannel,
                  voiceState: player.voiceState,
                  volume: player.volume,
                  position: payload.state.position || 0,
                },
              },
              {
                upsert: true,
              }
            );
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
        collection.updateOne(
          {
            id: player.guild,
          },
          {
            $set: {
              queue: player.queue,
              current: player.queue.current,
              position: 0,
            },
          },
          {
            upsert: true,
          }
        );
      });
    // @ts-ignore
    this.client.once("ready", async (client) => {
      await this.delay(this.options.delay ?? 2000);

      const database = (await this.Db.collection("persistentQueue")
        .find({})
        .toArray()) as any[];
      database.forEach((db) => {
        if (
          !db.voiceChannel ||
          !db.textChannel ||
          !db.id ||
          !db.current ||
          !client.channels.cache.get(db.voiceChannel) ||
          !client.channels.cache.get(db.textChannel)
        )
          return;
        const player = this.manager.create({
          voiceChannel: db.voiceChannel,
          textChannel: db.textChannel,
          guild: db.id,
        });
        player.connect();
        if (db.current)
          player.queue.add(
            TrackUtils.buildUnresolved(
              {
                title: db.current.title,
                author: db.current.author,
                duration: db.current.duration,
              },
              new User(client, db.current.requester)
            )
          );
        for (let track of db.queue) {
          player.queue.add(
            TrackUtils.buildUnresolved(
              {
                title: track.title,
                author: track.author,
                duration: track.duration,
              },
              new User(client, db.current.requester)
            )
          );
        }
        if (db.trackRepeat) player.setTrackRepeat(true);
        if (db.queueRepeat) player.setQueueRepeat(true);
        player.play(
          TrackUtils.buildUnresolved(
            player.queue.current!,
            new User(client, db.current.requester)
          ),
          { startTime: db.position ?? 0 }
        );
      });
    });
  }
  public delay(delayInms: number) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(2);
      }, delayInms);
    });
  }

  public async connectDB() {
    const client = new MongoClient(this.options.mongoDbUrl);
    this.clientDb = client;
    await client.connect();
    this.Db = client.db(this.options.mongoDbName || "erelaQueue");
  }
}
