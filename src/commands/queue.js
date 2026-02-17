const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getQueue } = require("../queue");

module.exports = {
  data: new SlashCommandBuilder().setName("queue").setDescription("Show the current queue"),
  async execute(interaction) {
    const queue = getQueue(interaction.guildId);
    if (!queue.tracks.length) {
      await interaction.reply({ content: "Queue is empty.", ephemeral: true });
      return;
    }
    const desc = queue.tracks
      .slice(0, 10)
      .map((t, i) => `${i + 1}. **${t.title}** (${t.duration})`)
      .join("\n");
    const embed = new EmbedBuilder()
      .setTitle("Queue")
      .setDescription(desc)
      .setColor(0x2f3136);
    await interaction.reply({ embeds: [embed] });
  },
};
