const { SlashCommandBuilder } = require("discord.js");
const { getQueue, hasDjRole, DJ_ROLE } = require("../queue");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the current track (DJ only)"),
  async execute(interaction) {
    const queue = getQueue(interaction.guildId);
    if (!queue.playing) {
      await interaction.reply({ content: "Nothing is playing.", ephemeral: true });
      return;
    }
    if (!hasDjRole(interaction.member)) {
      await interaction.reply({
        content: `DJ role (${DJ_ROLE}) required.`,
        ephemeral: true,
      });
      return;
    }
    queue.player.stop();
    await interaction.reply({ content: "Skipped." });
  },
};
