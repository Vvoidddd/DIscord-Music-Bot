const { SlashCommandBuilder } = require("discord.js");
const { getQueue, hasDjRole, DJ_ROLE } = require("../queue");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Set playback volume (0-100)")
    .addIntegerOption((opt) =>
      opt
        .setName("percent")
        .setDescription("Volume 0-100")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100)
    ),
  async execute(interaction) {
    const queue = getQueue(interaction.guildId);
    if (!hasDjRole(interaction.member)) {
      await interaction.reply({
        content: `DJ role (${DJ_ROLE}) required.`,
        ephemeral: true,
      });
      return;
    }

    const percent = interaction.options.getInteger("percent", true);
    const volume = percent / 100;
    queue.volume = volume;
    if (queue.currentResource?.volume) {
      queue.currentResource.volume.setVolume(queue.volume);
    }
    await interaction.reply({ content: `Volume set to ${percent}%` });
  },
};
