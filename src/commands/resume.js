const { SlashCommandBuilder } = require("discord.js");
const { getQueue, hasDjRole, DJ_ROLE } = require("../queue");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Resume playback (DJ only)"),
  async execute(interaction) {
    const queue = getQueue(interaction.guildId);
    if (!hasDjRole(interaction.member)) {
      await interaction.reply({
        content: `DJ role (${DJ_ROLE}) required.`,
        ephemeral: true,
      });
      return;
    }
    queue.player.unpause();
    await interaction.reply({ content: "Resumed." });
  },
};
