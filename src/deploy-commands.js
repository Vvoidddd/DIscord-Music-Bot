require("dotenv").config();

const { REST, Routes } = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error("Missing DISCORD_TOKEN or CLIENT_ID in .env");
  process.exit(1);
}

const { loadCommands } = require("./loader");

const commands = Array.from(loadCommands().values()).map((c) => c.data.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function deploy() {
  try {
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
        body: commands,
      });
      console.log("Registered guild commands.");
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log("Registered global commands.");
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

deploy();
