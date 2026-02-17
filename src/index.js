require("dotenv").config();

const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { getQueue, scheduleDisconnect } = require("./queue");
const { loadCommands } = require("./loader");

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error("Missing DISCORD_TOKEN in .env");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const commands = loadCommands();

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(err);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "Something went wrong.",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "Something went wrong.",
        ephemeral: true,
      });
    }
  }
});

client.on("error", console.error);

client.on("shardError", (error) => {
  console.error("Shard error:", error);
});

client.on("voiceStateUpdate", (oldState, newState) => {
  if (!oldState.channelId || newState.channelId) return;
  const queue = getQueue(oldState.guild.id);
  const membersLeft = oldState.channel?.members?.filter((m) => !m.user.bot) || [];
  if (membersLeft.size === 0 && queue.connection) {
    scheduleDisconnect(queue, oldState.guild.id);
  }
});

client.login(TOKEN);
