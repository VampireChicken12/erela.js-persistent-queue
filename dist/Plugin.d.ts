import { Manager, Plugin } from "erela.js";
import { PluginOptions } from "./typings";
import { Client } from "discord.js";
export declare class persistentQueue extends Plugin {
    private readonly options;
    private Db;
    private clientDb;
    private client;
    manager: Manager;
    constructor(client: Client, options: PluginOptions);
    load(manager: Manager): void;
    delay(delayInms: number): Promise<unknown>;
    connectDB(): Promise<void>;
}
