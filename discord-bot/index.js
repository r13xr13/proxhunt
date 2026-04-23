require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const API_URL = process.env.PROXHUNT_API || 'http://localhost:8080';
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

if (!TOKEN || TOKEN === 'YOUR_DISCORD_BOT_TOKEN_HERE') {
  console.log('ProxHunt: DISCORD_BOT_TOKEN not set. Bot will not start.');
  process.exit(1);
}

const EMBED_COLOR = 0x06b6d4;

const LEVEL_ORDER = ['Novice', 'Scout', 'Hunter', 'Tracker', 'Ranger', 'Legend'];

function getRankEmoji(level: string): string {
  const rank = LEVEL_ORDER.indexOf(level);
  return rank === -1 ? '🌱' : ['🌱', '🔭', '📡', '🗺️', '🚀', '👑'][rank];
}

async function sendLeaderboard(msg: any) {
  try {
    const response = await axios.get(`${API_URL}/api/rfid/leaderboard?limit=10`);
    const players = response.data;

    if (!players.length) {
      return msg.reply('No players yet. Start discovering RFID tags!');
    }

    const embed = new EmbedBuilder()
      .setTitle('🏆 ProxHunt Leaderboard')
      .setColor(EMBED_COLOR)
      .setDescription('Top RFID collectors')
      .setTimestamp();

    const fields = players.map((p: any, i: number) => ({
      name: `#${i + 1} ${getRankEmoji(p.level)} ${p.username}`,
      value: `**${p.total_points}** pts | ${p.level} | ${p.discovery_count} finds`,
      inline: true
    }));

    embed.addFields(fields);
    msg.reply({ embeds: [embed] });
  } catch (e) {
    msg.reply('Could not fetch leaderboard. Is the API running?');
  }
}

async function sendStats(msg: any) {
  try {
    const response = await axios.get(`${API_URL}/api/rfid/stats`);
    const stats = response.data;

    const embed = new EmbedBuilder()
      .setTitle('📊 ProxHunt Stats')
      .setColor(EMBED_COLOR)
      .addFields(
        { name: 'Unique Tags Discovered', value: `${stats.uniqueTags}`, inline: true },
        { name: 'Status', value: '🟢 Online', inline: true }
      );

    msg.reply({ embeds: [embed] });
  } catch (e) {
    msg.reply('Could not fetch stats. Is the API running?');
  }
}

client.once('ready', () => {
  console.log(`🤖 ProxHunt Bot logged in as ${client.user?.tag}`);
  client.user?.setActivity('RFID wardriving', { type: 3 });
});

client.on('messageCreate', async (msg) => {
  if (msg.author.bot || !msg.content.startsWith('!')) return;

  const [cmd, ...args] = msg.content.slice(1).split(' ');
  const arg = args.join(' ');

  switch (cmd.toLowerCase()) {
    case 'leaderboard':
    case 'lb':
      sendLeaderboard(msg);
      break;

    case 'stats':
      sendStats(msg);
      break;

    case 'help':
      msg.reply(`**ProxHunt Commands:**
- \`!leaderboard\` / \`!lb\` - Show top collectors
- \`!stats\` - View discovery stats
- \`!help\` - Show this help`);
      break;

    default:
      msg.reply(`Unknown command: ${cmd}. Try \`!help\``);
  }
});

client.login(TOKEN);

console.log('🤖 ProxHunt Discord Bot starting...');