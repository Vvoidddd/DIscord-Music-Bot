const { SlashCommandBuilder } = require("discord.js");
const { getQueue, hasDjRole, DJ_ROLE } = require("../queue");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop playback and clear the queue (DJ only)"),
  async execute(interaction) {
    const queue = getQueue(interaction.guildId);
    if (!hasDjRole(interaction.member)) {
      await interaction.reply({
        content: `DJ role (${DJ_ROLE}) required.`,
        ephemeral: true,
      });
      return;
    }
    queue.tracks = [];
    queue.player.stop();
    if (queue.connection) queue.connection.destroy();
    queue.connection = null;
    queue.playing = false;
    queue.nowPlaying = null;
    await interaction.reply({ content: "Stopped and cleared the queue." });
  },
};
