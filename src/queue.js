const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  getVoiceConnection,
} = require("@discordjs/voice");
const { PermissionsBitField } = require("discord.js");
const play = require("play-dl");

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

async function playTrack(queue, track) {
  if (!track) return;
  clearTimeout(queue.idleTimer);
  queue.nowPlaying = track;

  const stream = await play.stream(track.url);
  const resource = createAudioResource(stream.stream, {
    inputType: stream.type,
    inlineVolume: true,
  });
  resource.volume.setVolume(queue.volume);
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
};
