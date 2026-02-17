const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  demuxProbe,
  StreamType,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  getVoiceConnection,
} = require("@discordjs/voice");
const { PermissionsBitField } = require("discord.js");
const play = require("play-dl");
const ytdl = require("ytdl-core");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const YTDlpWrap = require("yt-dlp-wrap").default;
const path = require("path");
const fs = require("fs");

const ytdlp = new YTDlpWrap();
let ytdlpReady = false;

async function ensureYtDlp() {
  if (ytdlpReady) return;
  try {
    await ytdlp.getVersion();
    ytdlpReady = true;
  } catch {
    const binDir = path.join(__dirname, "..", "bin");
    fs.mkdirSync(binDir, { recursive: true });
    const binName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
    const binPath = path.join(binDir, binName);
    await YTDlpWrap.downloadFromGithub(binPath);
    ytdlp.setBinaryPath(binPath);
    ytdlpReady = true;
  }
}

const DJ_ROLE = (process.env.DJ_ROLE || "DJ").trim();
const IDLE_DISCONNECT_MS = 120000;

const queues = new Map();

function hasDjRole(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionsBitField.Flags.Administrator)) return true;
  return member.roles?.cache?.some((r) => r.name === DJ_ROLE);
}

function handleQueueFinish(queue, guildId) {
  queue.tracks.shift();
  if (queue.tracks.length > 0) {
    playTrack(queue, queue.tracks[0]).catch(console.error);
    return;
  }
  queue.playing = false;
  queue.nowPlaying = null;
  scheduleDisconnect(queue, guildId);
}

function bindPlayerEvents(queue, guildId) {
  if (queue.playerBound) return;
  queue.player.on(AudioPlayerStatus.Idle, () => {
    handleQueueFinish(queue, guildId);
  });
  queue.player.on("error", (error) => {
    console.error("Player error:", error);
    handleQueueFinish(queue, guildId);
  });
  queue.playerBound = true;
}

function getQueue(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, {
      guildId,
      textChannelId: null,
      voiceChannelId: null,
      connection: null,
      player: createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
      }),
      tracks: [],
      playing: false,
      idleTimer: null,
      volume: 0.5,
      nowPlaying: null,
      currentResource: null,
      playerBound: false,
    });
  }
  const queue = queues.get(guildId);
  bindPlayerEvents(queue, guildId);
  return queue;
}

async function ensureVoice(interaction) {
  const member = interaction.member;
  const voiceChannel = member?.voice?.channel;
  if (!voiceChannel) {
    await interaction.reply({
      content: "Join a voice channel first.",
      ephemeral: true,
    });
    return null;
  }

  const queue = getQueue(interaction.guildId);
  queue.textChannelId = interaction.channelId;

  if (queue.connection && queue.voiceChannelId === voiceChannel.id) {
    return queue;
  }

  if (queue.connection && queue.voiceChannelId !== voiceChannel.id) {
    const canMove = hasDjRole(member);
    if (!canMove) {
      await interaction.reply({
        content: `I'm already playing in <#${queue.voiceChannelId}>. DJ role (${DJ_ROLE}) required to move me.`,
        ephemeral: true,
      });
      return null;
    }
  }

  queue.voiceChannelId = voiceChannel.id;
  queue.connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: interaction.guildId,
    adapterCreator: interaction.guild.voiceAdapterCreator,
    selfDeaf: true,
  });

  queue.connection.subscribe(queue.player);
  return queue;
}

function isValidUrl(url) {
  return typeof url === "string" && /^https?:\/\//.test(url);
}

async function playTrack(queue, track) {
  if (!track || !isValidUrl(track.url)) {
    console.error("Invalid track URL:", track);
    handleQueueFinish(queue, queue.guildId);
    return;
  }
  clearTimeout(queue.idleTimer);
  queue.nowPlaying = track;

  let resource;
  try {
    console.log("Streaming URL:", track.url);
    if (ytdl.validateURL(track.url)) {
      try {
        const ytdlStream = ytdl(track.url, {
          filter: "audioonly",
          quality: "highestaudio",
          highWaterMark: 1 << 25,
        });
        const probe = await demuxProbe(ytdlStream);
        resource = createAudioResource(probe.stream, {
          inputType: probe.type,
          inlineVolume: true,
        });
      } catch (err) {
        console.error("ytdl-core failed, falling back to yt-dlp:", err);
        await ensureYtDlp();
        const direct = await ytdlp.execPromise([
          "-f",
          "bestaudio",
          "-g",
          track.url,
        ]);
        const directUrl = direct.split(/\r?\n/)[0].trim();
        if (!isValidUrl(directUrl)) {
          throw new Error("yt-dlp returned invalid URL");
        }
        const ffmpeg = spawn(ffmpegPath, [
          "-reconnect",
          "1",
          "-reconnect_streamed",
          "1",
          "-reconnect_delay_max",
          "5",
          "-i",
          directUrl,
          "-analyzeduration",
          "0",
          "-loglevel",
          "0",
          "-f",
          "s16le",
          "-ar",
          "48000",
          "-ac",
          "2",
          "pipe:1",
        ]);
        ffmpeg.on("error", (ffErr) => {
          console.error("ffmpeg error:", ffErr);
        });
        resource = createAudioResource(ffmpeg.stdout, {
          inputType: StreamType.Raw,
          inlineVolume: true,
        });
      }
    } else {
      const stream = await play.stream(track.url);
      resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true,
      });
    }
  } catch (err) {
    console.error("Stream error:", err);
    handleQueueFinish(queue, queue.guildId);
    return;
  }
  resource.volume.setVolume(queue.volume);
  queue.currentResource = resource;
  queue.player.play(resource);
  queue.playing = true;
}

function scheduleDisconnect(queue, guildId) {
  clearTimeout(queue.idleTimer);
  queue.idleTimer = setTimeout(() => {
    const connection = getVoiceConnection(guildId);
    if (connection) connection.destroy();
    queue.connection = null;
    queue.playing = false;
    queue.nowPlaying = null;
    queue.tracks = [];
  }, IDLE_DISCONNECT_MS);
}

module.exports = {
  getQueue,
  ensureVoice,
  playTrack,
  scheduleDisconnect,
  hasDjRole,
  DJ_ROLE,
  isValidUrl,
};
