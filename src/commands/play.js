const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const play = require("play-dl");
const yts = require("yt-search");
const { ensureVoice, playTrack, getQueue } = require("../queue");

const REACTION_EMOJIS = [
  "\u0031\uFE0F\u20E3",
  "\u0032\uFE0F\u20E3",
  "\u0033\uFE0F\u20E3",
  "\u0034\uFE0F\u20E3",
  "\u0035\uFE0F\u20E3",
];

function normalizeResult(result) {
  const urlCandidate =
    result.url ||
    result.videoUrl ||
    result.link ||
    (result.id ? `https://www.youtube.com/watch?v=${result.id}` : null);
  const url =
    typeof urlCandidate === "string" && /^https?:\/\//.test(urlCandidate)
      ? urlCandidate
      : null;
  return {
    title: result.title || result.name || "Unknown title",
    url,
    durationRaw: result.durationRaw || result.duration || result.timestamp || "",
  };
}

function isValidUrl(url) {
  return typeof url === "string" && /^https?:\/\//.test(url);
}

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

    const validation = await play.validate(query);
    let results = [];

    if (
      validation &&
      validation !== "search" &&
      (query.startsWith("http://") || query.startsWith("https://"))
    ) {
      results = [{ title: query, url: query, durationRaw: "" }];
    } else {
      try {
        results = await play.search(query, { limit: 5 });
      } catch (err) {
        const search = await yts(query);
        results = (search?.videos || []).slice(0, 5);
      }
      results = results.map(normalizeResult).filter((r) => isValidUrl(r.url));
    }

    if (!results.length) {
      await interaction.reply({ content: "No results found.", ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder().setColor(0x2f3136);
    if (results.length === 1 && results[0].url === query) {
      embed
        .setTitle("Loading link")
        .setDescription(`${results[0].url}`)
        .setFooter({ text: "Adding to queue." });
    } else {
      embed
        .setTitle("Pick a track")
        .setDescription(
          results
            .map((r, i) => {
              const duration = r.durationRaw || "live";
              return `${i + 1}. **${r.title}** (${duration})\n${r.url}`;
            })
            .join("\n\n")
        )
        .setFooter({ text: "React 1-5 within 30 seconds." });
    }

    const message = await interaction.reply({
      embeds: [embed],
      fetchReply: true,
    });

    if (results.length === 1 && results[0].url === query) {
      const guildQueue = getQueue(interaction.guildId);
      guildQueue.tracks.push({
        title: query,
        url: query,
        duration: "",
        requestedBy: interaction.user.tag,
      });
      await interaction.followUp({ content: "Queued link." });
      if (!guildQueue.playing) {
        await playTrack(guildQueue, guildQueue.tracks[0]);
      }
      return;
    }

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
      if (!picked?.url || !isValidUrl(picked.url)) {
        await interaction.followUp({ content: "Invalid selection." });
        return;
      }
      console.log("Picked track:", picked.title, picked.url);

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
