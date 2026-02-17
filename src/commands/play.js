const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const play = require("play-dl");
const { ensureVoice, playTrack, getQueue } = require("../queue");

const REACTION_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Search and play a track")
    .addStringOption((opt) =>
      opt.setName("query").setDescription("Song name or URL").setRequired(true)
    ),
  async execute(interaction) {
    const query = interaction.options.getString("query", true);
    const queue = await ensureVoice(interaction);
    if (!queue) return;

    const results = await play.search(query, { limit: 5 });
    if (!results.length) {
      await interaction.reply({ content: "No results found.", ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Pick a track")
      .setColor(0x2f3136)
      .setDescription(
        results
          .map((r, i) => {
            const duration = r.durationRaw || "live";
            return `${i + 1}. **${r.title}** (${duration})\n${r.url}`;
          })
          .join("\n\n")
      )
      .setFooter({ text: "React 1-5 within 30 seconds." });

    const message = await interaction.reply({
      embeds: [embed],
      fetchReply: true,
    });

    const usableCount = Math.min(results.length, REACTION_EMOJIS.length);
    for (let i = 0; i < usableCount; i += 1) {
      await message.react(REACTION_EMOJIS[i]);
    }

    const collector = message.createReactionCollector({
      time: 30000,
      max: 1,
      filter: (reaction, user) => {
        if (user.id !== interaction.user.id) return false;
        return REACTION_EMOJIS.includes(reaction.emoji.name);
      },
    });

    collector.on("collect", async (reaction) => {
      if (reaction.partial) {
        try {
          await reaction.fetch();
        } catch (err) {
          console.error("Failed to fetch reaction:", err);
          return;
        }
      }
      const index = REACTION_EMOJIS.indexOf(reaction.emoji.name);
      const picked = results[index];
      if (!picked) return;

      const guildQueue = getQueue(interaction.guildId);
      guildQueue.tracks.push({
        title: picked.title,
        url: picked.url,
        duration: picked.durationRaw || "live",
        requestedBy: interaction.user.tag,
      });

      await interaction.followUp({
        content: `Queued: **${picked.title}**`,
      });

      if (!guildQueue.playing) {
        await playTrack(guildQueue, guildQueue.tracks[0]);
      }
    });

    collector.on("end", async (collected) => {
      if (collected.size === 0) {
        await interaction.followUp({ content: "Selection timed out." });
      }
    });
  },
};
