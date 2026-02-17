const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getQueue } = require("../queue");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("Show the current track"),
  async execute(interaction) {
    const queue = getQueue(interaction.guildId);
    if (!queue.nowPlaying) {
      await interaction.reply({ content: "Nothing is playing.", ephemeral: true });
      return;
    }
    const embed = new EmbedBuilder()
      .setTitle("Now Playing")
      .setDescription(`**${queue.nowPlaying.title}**\n${queue.nowPlaying.url}`)
      .setColor(0x2f3136);
    await interaction.reply({ embeds: [embed] });
  },
};
