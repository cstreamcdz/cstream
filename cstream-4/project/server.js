import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createHttpServer } from "http";
import compression from "compression";
import os from "os";
import CHANNELS_DATABASE from "./src/data/channels.js";
import { Client, GatewayIntentBits, ActivityType, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV !== "production";
const app = express();

app.use(compression());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use((req, res, next) => {
  const origin = req.headers.origin || "*";
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, Origin, X-Requested-With");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// --- DISCORD BOT ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

const DISCORD_TOKEN = "MTQ0NDcyMTU0MzQ4NDgwNTEzMg.GDb_wO.kmL-xZvpBm7qd-o-sYaZAeWtYM-UGcLT1GUOKg";
const GUILD_ID = "1444721543484805132";
const BOOST_CHANNEL_ID = "1466080992627265648";
const NOTIF_CHANNEL_ID = "1454425396303888426"; // Admin/Notifications channel
const SITE_URL = "https://cstream.replit.app";

// Direct Discord notification helper (instant, no queue)
async function sendDiscordNotification(embed) {
  try {
    if (!client.isReady()) {
      console.log("[Discord] Bot not ready, queuing notification");
      return false;
    }
    const channel = await client.channels.fetch(NOTIF_CHANNEL_ID).catch(() => null);
    if (channel && channel.isTextBased()) {
      await channel.send({ embeds: [embed] });
      console.log("[Discord] Notification sent to admin channel");
      return true;
    }
    console.log("[Discord] Channel not found or not text-based");
    return false;
  } catch (e) {
    console.error("[Discord] Notification error:", e.message);
    return false;
  }
}

const commands = [
  new SlashCommandBuilder()
    .setName('health')
    .setDescription('Vérifier l\'état de santé du bot et du site'),
  new SlashCommandBuilder()
    .setName('search')
    .setDescription('Rechercher un film, une série ou un anime via TMDB')
    .addStringOption(option =>
      option.setName('query').setDescription('Nom du film, série ou anime').setRequired(true))
    .addStringOption(option =>
      option.setName('type').setDescription('Type de média').setRequired(true)
        .addChoices(
          { name: 'Film', value: 'movie' },
          { name: 'Série', value: 'tv' },
          { name: 'Anime', value: 'anime' }
        )),
  new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Vérifier votre compte CStream'),
  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Voir vos informations'),
  new SlashCommandBuilder()
    .setName('support')
    .setDescription('Infos pour soutenir CStream'),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Afficher les commandes disponibles'),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

async function deployCommands() {
  try {
    if (!client.user) return;
    console.log("Attempting to deploy slash commands globally...");
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("Slash commands deployed globally");
  } catch (error) {
    console.error("Error deploying commands:", error);
  }
}

client.on("ready", () => {
  console.log(`Bot Discord connecté: ${client.user.tag}`);

  // Status: Streaming "regarde CStream"
  client.user.setPresence({
    activities: [{
      name: "regarde CStream",
      type: ActivityType.Streaming,
      url: "https://www.twitch.tv/cstream"
    }],
    status: "online",
  });

  deployCommands();
});

// Auto-login bot in production to ensure it stays online
if (!isDev) {
  client.login(DISCORD_TOKEN).catch(err => {
    console.error("Critical: Discord bot failed to login in production:", err);
  });
}

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const boosterRole = newMember.guild.roles.cache.find(r => r.name === 'Server Booster');
  if (!boosterRole) return;

  const hadBoost = oldMember.premiumSince;
  const hasBoost = newMember.premiumSince;

  if (!hadBoost && hasBoost) {
    try {
      await newMember.roles.add(boosterRole);
      const boostChannel = newMember.guild.channels.cache.get(BOOST_CHANNEL_ID);
      if (boostChannel?.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor(0x8b5cf6)
          .setTitle("Nouveau Boost ! 💜 / New Boost! 💜")
          .setDescription(`**FR :** 💜 Merci infiniment pour le boost, ${newMember} ! Votre soutien aide CStream à grandir. Le rôle **Server Booster** vous a été attribué.\n\n**EN :** 💜 Thank you so much for the boost, ${newMember}! Your support helps CStream grow. The **Server Booster** role has been assigned to you.`)
          .setTimestamp();
        await boostChannel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error("Error handling boost:", error);
    }
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'health') {
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('🏥 État de Santé / Health Status')
      .addFields(
        { name: 'Bot Discord', value: '✅ En ligne / Online', inline: true },
        { name: 'Serveur CStream', value: '✅ Connecté / Connected', inline: true },
        { name: 'Version', value: 'v4.5 Premium', inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'CStream System Monitoring' });
    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'search') {
    const query = interaction.options.getString('query', true);
    const type = interaction.options.getString('type', true);
    await interaction.deferReply();

    try {
      const searchType = type === 'anime' ? 'tv' : type;
      const tmdbKey = process.env.VITE_TMDB_API_KEY;
      const res = await fetch(`https://api.themoviedb.org/3/search/${searchType}?api_key=${tmdbKey}&query=${encodeURIComponent(query)}&language=fr-FR`);
      const data = await res.json();

      if (!data.results?.length) return interaction.editReply(`❌ Aucun résultat trouvé pour **${query}** / No results found for **${query}**`);

      const item = data.results[0];
      const title = item.title || item.name;
      const mediaUrl = `${SITE_URL}/${type}/${item.id}`;

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(title)
        .setDescription(`🎬 Cliquez sur le bouton ci‑dessous pour regarder sur **CStream** / Click below to watch on **CStream**`)
        .setThumbnail(item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null)
        .setFooter({ text: 'Powered by TMDB • CStream' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Regarder sur CStream / Watch on CStream')
          .setStyle(ButtonStyle.Link)
          .setURL(mediaUrl)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (e) {
      console.error(e);
      await interaction.editReply('❌ Une erreur est survenue / An error occurred.');
    }
  }

  if (interaction.commandName === 'help') {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📚 Commandes disponibles / Available Commands')
      .setDescription(`**FR :**\n• \`/search\` – Rechercher un film, une série ou un anime via TMDB\n• \`/verify\` – Vérifier votre compte CStream\n• \`/profile\` – Voir vos informations\n• \`/support\` – Infos pour soutenir CStream\n\n**EN :**\n• \`/search\` – Search movies, series or anime via TMDB\n• \`/verify\` – Verify your CStream account\n• \`/profile\` – View your information\n• \`/support\` – Support CStream`)
      .setFooter({ text: 'CStream Bot' });
    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'support') {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('💜 Soutenir CStream / Support CStream')
      .setDescription(`**FR :** Votre soutien nous aide à garder le site gratuit et sans pub !\n**EN :** Your support helps us keep the site free and ad-free!`)
      .addFields(
        { name: 'PayPal', value: 'https://paypal.me/CDZ68', inline: true },
        { name: 'Ko-Fi', value: 'https://ko-fi.com/cstream', inline: true }
      );
    await interaction.reply({ embeds: [embed] });
  }
});

// Bot status tracking
let botRunning = false;

// Note: Main Discord bot runs in bot/index.js workflow
// This legacy code is kept but disabled to prevent duplicate connections

app.post('/api/admin/bot/start', async (req, res) => {
  if (botRunning) return res.json({ ok: true, message: 'Bot déjà démarré' });
  try {
    await client.login(DISCORD_TOKEN);
    botRunning = true;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/admin/bot/stop', async (req, res) => {
  if (!botRunning) return res.json({ ok: true, message: 'Bot déjà arrêté' });
  client.destroy();
  botRunning = false;
  res.json({ ok: true });
});

app.get('/api/admin/bot/status', (req, res) => {
  try {
    const statusPath = path.join(__dirname, '..', 'bot', 'bot-status.json');
    if (fs.existsSync(statusPath)) {
      const statusData = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      const lastUpdate = new Date(statusData.lastUpdate);
      const now = new Date();
      const diffSeconds = (now - lastUpdate) / 1000;

      if (statusData.connected && diffSeconds < 60) {
        return res.json({
          running: true,
          connected: true,
          message: "Bot Discord connecté",
          botUser: { tag: statusData.botTag }
        });
      }
    }
  } catch (e) {
    console.error('Error reading bot status:', e);
  }
  res.json({ running: botRunning, connected: false, botUser: null });
});

app.get('/api/discord/status', (req, res) => {
  try {
    const statusPath = path.join(__dirname, '..', 'bot', 'bot-status.json');
    if (fs.existsSync(statusPath)) {
      const statusData = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      const lastUpdate = new Date(statusData.lastUpdate);
      const now = new Date();
      const diffSeconds = (now - lastUpdate) / 1000;

      if (statusData.connected && diffSeconds < 60) {
        return res.json({
          connected: true,
          message: "Bot Discord connecté",
          botUser: { tag: statusData.botTag },
          lastUpdate: statusData.lastUpdate
        });
      }
    }
  } catch (e) {
    console.error('Error reading bot status:', e);
  }
  res.json({ connected: false, message: "Bot Discord non connecté", botUser: null });
});

app.get('/api/admin/bot/channels', (req, res) => {
  try {
    const dataPath = path.join(__dirname, '../bot/bot-data.json');
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      return res.json({ channels: data.channels || [], guildName: data.guildName });
    }
  } catch (e) {
    console.error('Error reading bot data:', e);
  }
  res.json({ channels: [] });
});

app.post('/api/admin/bot/notify', async (req, res) => {
  const { channelId, message, embed } = req.body;
  if (!channelId || (!message && !embed)) {
    return res.status(400).json({ ok: false, success: false, error: "Données manquantes" });
  }

  try {
    const notifyRequestPath = path.join(__dirname, '../bot/notify-request.json');
    fs.writeFileSync(notifyRequestPath, JSON.stringify({
      channelId,
      message,
      embed,
      timestamp: new Date().toISOString(),
      status: 'pending'
    }));
    res.json({ ok: true, success: true, message: "OK" });
  } catch (e) {
    res.status(500).json({ ok: false, success: false, error: e.message });
  }
});

// --- SYSTEM MONITORING & TICKETS (Added for Admin Beta) ---

app.get('/api/admin/system-stats', (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const stats = {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
      },
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        pid: process.pid
      },
      botRunning
    };
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    const { userId, subject, message, username } = req.body;

    // Save to tickets.json
    const ticketsPath = path.join(__dirname, 'tickets.json');
    let tickets = [];
    if (fs.existsSync(ticketsPath)) {
      try {
        tickets = JSON.parse(fs.readFileSync(ticketsPath, 'utf8'));
      } catch (e) { tickets = []; }
    }

    const newTicket = {
      id: "TICK-" + Date.now().toString().slice(-6),
      userId,
      username: username || "Anonyme",
      subject,
      message,
      status: 'open',
      priority: 'normal',
      created_at: new Date().toISOString(),
      updates: []
    };

    tickets.unshift(newTicket);

    console.log(`[Tickets] Saving ticket to ${ticketsPath}`);
    if (!fs.existsSync(ticketsPath)) {
      console.log("[Tickets] Creating new tickets.json file");
      fs.writeFileSync(ticketsPath, JSON.stringify([], null, 2));
    }

    fs.writeFileSync(ticketsPath, JSON.stringify(tickets.slice(0, 1000), null, 2));
    console.log(`[Tickets] Saved ${tickets.length} tickets`);

    // Notify Discord directly (instant)
    const ticketEmbed = new EmbedBuilder()
      .setColor(0xeab308)
      .setTitle('🎫 Nouveau Ticket Support')
      .setDescription(`**De:** ${newTicket.username}\n**Sujet:** ${subject}\n**Message:** ${message.slice(0, 500)}`)
      .setFooter({ text: `Ticket ID: ${newTicket.id}` })
      .setTimestamp();

    // Also try to send to channel specifically
    try {
      await sendDiscordNotification(ticketEmbed);
    } catch (err) {
      console.error("[Tickets] Discord notification failed:", err);
    }

    res.json({ ok: true, ticketId: newTicket.id });
  } catch (e) {
    console.error("Contact API Error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/admin/tickets', (req, res) => {
  try {
    const ticketsPath = path.join(__dirname, 'tickets.json');
    if (fs.existsSync(ticketsPath)) {
      const tickets = JSON.parse(fs.readFileSync(ticketsPath, 'utf8'));
      res.json({ tickets });
    } else {
      res.json({ tickets: [] });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- UTILS ---
function queueDiscordNotification(data) {
  try {
    const notifyRequestPath = path.join(__dirname, '../bot/notify-request.json');
    let queue = [];
    if (fs.existsSync(notifyRequestPath)) {
      try {
        const content = fs.readFileSync(notifyRequestPath, 'utf8');
        if (content.trim()) {
          const parsed = JSON.parse(content);
          queue = Array.isArray(parsed) ? parsed : [parsed];
        }
      } catch (e) { queue = []; }
    }

    queue.push({
      ...data,
      status: 'pending',
      timestamp: new Date().toISOString()
    });

    fs.writeFileSync(notifyRequestPath, JSON.stringify(queue, null, 2));
    return true;
  } catch (e) {
    console.error('Error queuing notification:', e);
    return false;
  }
}

// --- SERVICE STATUS ---
app.get('/api/service-status', async (req, res) => {
  try {
    // Check TMDB
    const tmdbKey = process.env.VITE_TMDB_API_KEY;
    const tmdbStatus = !!tmdbKey;

    // Check Groq (if applicable, else mock true if key exists)
    const groqStatus = !!process.env.GROQ_API_KEY;

    // Check Github (mock)
    const githubStatus = true;

    // Check Discord
    // We reuse the botRunning status or check the bot status file
    let discordStatus = botRunning;
    if (!discordStatus) {
      try {
        const statusPath = path.join(__dirname, '..', 'bot', 'bot-status.json');
        console.log(`[Service Status] Checking bot status at: ${statusPath}`);
        if (fs.existsSync(statusPath)) {
          const statusContent = fs.readFileSync(statusPath, 'utf8');
          console.log(`[Service Status] Bot status content: ${statusContent}`);
          const statusData = JSON.parse(statusContent);
          const lastUpdate = new Date(statusData.lastUpdate);
          if ((new Date() - lastUpdate) < 60000) {
            discordStatus = true;
            console.log("[Service Status] Bot file indicates ONLINE");
          } else {
            console.log("[Service Status] Bot file stale");
          }
        } else {
          console.log("[Service Status] Bot status file NOT FOUND");
        }
      } catch (e) {
        console.error("[Service Status] Error checking bot status:", e);
      }
    }

    res.json({
      tmdb: tmdbStatus,
      groq: groqStatus,
      github: githubStatus,
      discordBot: discordStatus
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- ANALYTICS & COOKIE CONSENT ---

app.post('/api/cookie-consent', async (req, res) => {
  try {
    const { preferences, userEmail, username, language, platform } = req.body;

    // Log to a file for the Admin page to read
    const consentLogPath = path.join(__dirname, 'cookie-consents.json');
    let consents = [];
    if (fs.existsSync(consentLogPath)) {
      try {
        consents = JSON.parse(fs.readFileSync(consentLogPath, 'utf8'));
      } catch (e) { consents = []; }
    }

    const newConsent = {
      id: Math.random().toString(36).substr(2, 9),
      ...req.body,
      ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      created_at: new Date().toISOString()
    };

    consents.unshift(newConsent);
    fs.writeFileSync(consentLogPath, JSON.stringify(consents.slice(0, 500), null, 2));

    // Notify Discord
    queueDiscordNotification({
      channelId: "1454425396303888426", // Analytics channel
      embed
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('Cookie consent error:', e);
    res.status(500).json({ ok: false });
  }
});

app.post('/api/analytics/event', async (req, res) => {
  try {
    const { type, data, user } = req.body;
    let title = "📊 Nouvel Évènement";
    let color = "#3b82f6";

    if (type === 'signup') {
      title = "🆕 Nouvel Utilisateur !";
      color = "#10b981";
    } else if (type === 'login') {
      title = "🔑 Connexion";
      color = "#6366f1";
    }

    const embed = {
      title,
      description: `**Utilisateur:** ${user?.username || 'Inconnu'}\n**Email:** ${user?.email || 'N/A'}\n**Détails:** ${JSON.stringify(data || {})}`,
      color,
      timestamp: new Date().toISOString()
    };

    queueDiscordNotification({
      channelId: "1454425396303888426", // Analytics channel
      embed
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

app.post('/api/analytics/visit', async (req, res) => {
  try {
    const { username, visitorId, platform, language } = req.body;

    const embed = {
      title: "👤 Nouveau Visiteur !",
      description: `Un utilisateur a visité le site.\n\n**Utilisateur:** ${username || 'Inconnu'}\n**Visitor ID:** ${visitorId || 'N/A'}\n**Plateforme:** ${platform || 'N/A'}\n**Langue:** ${language || 'N/A'}`,
      color: "#10b981",
      timestamp: new Date().toISOString()
    };

    queueDiscordNotification({
      channelId: "1454425396303888426", // Analytics channel
      embed
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('Visit analytics error:', e);
    res.status(500).json({ ok: false });
  }
});

app.post('/api/discord/dm', async (req, res) => {
  const { userId, message, embed } = req.body;
  if (!userId || (!message && !embed)) {
    return res.status(400).json({ ok: false, success: false, error: "Données manquantes" });
  }

  try {
    const dmRequestPath = path.join(__dirname, '../bot/dm-request.json');
    fs.writeFileSync(dmRequestPath, JSON.stringify({
      userId,
      message,
      embed,
      timestamp: new Date().toISOString(),
      status: 'pending'
    }));
    res.json({ ok: true, success: true, message: "OK" });
  } catch (e) {
    res.status(500).json({ ok: false, success: false, error: e.message });
  }
});

app.post('/api/discord/setup-channel', async (req, res) => {
  res.json({ ok: true, success: true });
});

app.post('/api/discord/save-config', async (req, res) => {
  res.json({ ok: true, success: true });
});

app.get('/api/discord/channels', (req, res) => {
  try {
    const dataPath = path.join(__dirname, '../bot/bot-data.json');
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      return res.json({ channels: data.channels || [] });
    }
  } catch (e) { }
  res.json({ channels: [] });
});
app.get('/api/discord/members', (req, res) => {
  try {
    const dataPath = path.join(__dirname, '../bot/bot-data.json');
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      return res.json({ members: data.members || [] });
    }
  } catch (e) {
    console.error('Error reading bot data for members:', e);
  }
  res.json({ members: [] });
});

app.get('/api/bot/status', (req, res) => {
  try {
    const statusPath = path.join(__dirname, '../bot/bot-status.json');
    if (fs.existsSync(statusPath)) {
      const statusData = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      if (statusData.connected) {
        return res.json({ status: 'online' });
      }
    }
  } catch (e) { }
  res.json({ status: 'offline' });
});

app.get('/api/admin/cookie-consents', (req, res) => {
  try {
    const consentLogPath = path.join(__dirname, 'cookie-consents.json');
    if (fs.existsSync(consentLogPath)) {
      const consents = JSON.parse(fs.readFileSync(consentLogPath, 'utf8'));
      res.json({ consents });
    } else {
      res.json({ consents: [] });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/cookie-consents/:id', (req, res) => {
  try {
    const { id } = req.params;
    const consentLogPath = path.join(__dirname, 'cookie-consents.json');
    if (fs.existsSync(consentLogPath)) {
      let consents = JSON.parse(fs.readFileSync(consentLogPath, 'utf8'));
      consents = consents.filter(c => c.id !== id);
      fs.writeFileSync(consentLogPath, JSON.stringify(consents, null, 2));
      res.json({ ok: true });
    } else {
      res.status(404).json({ error: "Non trouvé" });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/logs', (req, res) => {
  try {
    // Generate some mock logs if file doesn't exist, or read from a logs file
    const logsPath = path.join(__dirname, 'activity-logs.json');
    if (fs.existsSync(logsPath)) {
      const logs = JSON.parse(fs.readFileSync(logsPath, 'utf8'));
      res.json({ logs });
    } else {
      // Return recent cookie consents as activity logs for now if no other logs
      const consentLogPath = path.join(__dirname, 'cookie-consents.json');
      if (fs.existsSync(consentLogPath)) {
        const consents = JSON.parse(fs.readFileSync(consentLogPath, 'utf8'));
        const logs = consents.map(c => ({
          id: c.id,
          type: 'cookie_consent',
          message: `Consentement cookie de ${c.username || 'Anonyme'}`,
          timestamp: c.created_at,
          details: c.preferences
        }));
        res.json({ logs });
      } else {
        res.json({ logs: [] });
      }
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/discord/dm', async (req, res) => {
  const { userId, message, embed } = req.body;
  if (!userId || (!message && !embed)) {
    return res.status(400).json({ ok: false, error: "userId et message/embed requis" });
  }

  try {
    const notifyRequestPath = path.join(__dirname, '../bot/dm-request.json');
    fs.writeFileSync(notifyRequestPath, JSON.stringify({
      userId,
      message,
      embed,
      timestamp: new Date().toISOString(),
      status: 'pending'
    }));
    res.json({ ok: true, message: "Demande de DM envoyée" });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.post('/api/verify-discord', async (req, res) => {
  const { discordId } = req.body;
  if (!botRunning) return res.status(500).json({ ok: false, error: "Le bot n'est pas démarré" });

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(discordId);
    const verifiedRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'verified');

    if (verifiedRole) await member.roles.add(verifiedRole);

    await member.send({
      content: `✅ **Merci beaucoup !**\nVous êtes maintenant **vérifié** sur Discord et sur CStream.\nVotre rôle **Verified** a été ajouté avec succès.\n\n✅ **Thank you!**\nYou are now **verified** on Discord and on CStream.\nYour **Verified** role has been successfully added.\n\n🔗 Accédez au site / Access the website: ${SITE_URL}`
    }).catch(() => console.log("Impossible d'envoyer un DM à l'utilisateur"));

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// --- DADDYHD LIVE TV API ENGINE v6.0 ---
app.get("/api/livetv/channels", async (req, res) => {
  try {
    const DADDY_KEY = process.env.DADDY_KEY || "YOUR_KEY";
    const response = await fetch(`https://dlhd.link/daddyapi.php?key=${DADDY_KEY}&endpoint=channels`);

    let apiChannels = [];
    if (response.ok) {
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        apiChannels = data.data.map(c => ({
          id: c.channel_id,
          name: c.channel_name,
          logo: c.logo_url?.startsWith('http') ? c.logo_url : `https://dlhd.link/${c.logo_url || 'logos/default.png'}`,
          url: `https://dlhd.link/stream/stream-${c.channel_id}.php`,
          category: c.category || "Live TV"
        }));
      }
    }

    const mergedChannels = CHANNELS_DATABASE.map(c => ({
      ...c,
      logo: `https://dlhd.link/logos/${c.id}.png`,
      url: `https://dlhd.link/stream/stream-${c.id}.php`
    }));

    apiChannels.forEach(ac => {
      const idx = mergedChannels.findIndex(mc => mc.id === ac.id);
      if (idx !== -1) {
        mergedChannels[idx] = { ...mergedChannels[idx], ...ac };
      } else {
        mergedChannels.push(ac);
      }
    });

    return res.json(mergedChannels);
  } catch (error) {
    res.json(CHANNELS_DATABASE.map(c => ({
      ...c,
      logo: `https://dlhd.link/logos/${c.id}.png`,
      url: `https://dlhd.link/stream/stream-${c.id}.php`
    })));
  }
});

app.get("/api/livetv/schedule", async (req, res) => {
  try {
    const DADDY_KEY = process.env.DADDY_KEY || "YOUR_KEY";
    const response = await fetch(`https://dlhd.link/daddyapi.php?key=${DADDY_KEY}&endpoint=schedule`);
    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    }
    res.status(500).json({ error: "Failed to fetch schedule" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/livetv/info", async (req, res) => {
  try {
    const DADDY_KEY = process.env.DADDY_KEY || "YOUR_KEY";
    const response = await fetch(`https://dlhd.link/daddyapi.php?key=${DADDY_KEY}&endpoint=info`);
    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    }
    res.status(500).json({ error: "Failed to fetch info" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- SPORTS API PROXY (streamed.pk) ---
app.get("/api/sports", async (req, res) => {
  try {
    const response = await fetch("https://streamed.pk/api/sports");
    if (!response.ok) throw new Error("Streamed.pk error");
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.json([
      { id: "football", name: "Football" },
      { id: "basketball", name: "Basketball" },
      { id: "tennis", name: "Tennis" }
    ]);
  }
});

app.get("/api/sports/matches/:sport", async (req, res) => {
  try {
    const { sport } = req.params;
    const response = await fetch(`https://streamed.pk/api/matches/${sport}`);
    if (!response.ok) throw new Error("Streamed.pk error");
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/sports/stream/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const response = await fetch(`https://streamed.pk/api/stream/${id}`);
    if (!response.ok) throw new Error("Streamed.pk error");
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- CHAT AI API (Groq) ---
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, includeMedia, character } = req.body;
    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
      return res.json({ response: "🤖 Agent IA non configuré. Contactez l'administrateur." });
    }

    const systemPrompt = `Tu es CStream AI, l'assistant intelligent de CStream, une plateforme de streaming.
Tu es amical, enthousiaste et expert en cinéma, séries TV et anime.
Tu réponds TOUJOURS en français.
Tu peux recommander des films, séries et anime basés sur les goûts de l'utilisateur.
Sois concis mais informatif. Utilise des emojis parfois pour être plus engageant.
Si on te pose une question sur un film/série/anime spécifique, donne des infos pertinentes (intrigue, cast, notes).`;

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
        ],
        max_tokens: 1024,
        temperature: 0.7
      })
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      console.error("Groq API error:", errText);
      return res.json({ response: "⚠️ Service IA temporairement indisponible. Réessayez dans quelques instants." });
    }

    const data = await groqResponse.json();
    const aiResponse = data.choices?.[0]?.message?.content || "Je réfléchis encore...";

    return res.json({ response: aiResponse });
  } catch (error) {
    console.error("Chat API Error:", error);
    res.status(500).json({ response: "Erreur neuronale : " + error.message });
  }
});

// ============================================
// ADMIN & SYSTEM ROUTES
// ============================================
app.get("/api/admin/system-stats", (req, res) => {
  try {
    const mem = process.memoryUsage();
    const stats = {
      uptime: process.uptime(),
      memory: {
        rss: (mem.rss / 1024 / 1024).toFixed(2) + " MB",
        heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(2) + " MB",
        heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(2) + " MB"
      },
      system: {
        platform: os.platform(),
        nodeVersion: process.version
      },
      botRunning: client.isReady(),
      timestamp: new Date().toISOString()
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/tickets", (req, res) => {
  res.json({ tickets: [] });
});

app.post("/api/cookie-consent", express.json(), (req, res) => {
  console.log("🍪 Cookie consent received:", req.body);
  res.json({ success: true, message: "Consent saved" });
});

async function startServer() {
  const httpServer = createHttpServer(app);

  // Health check endpoint for Replit deployment
  app.get("/health", (req, res) => res.status(200).send("OK"));
  app.get("/ping", (req, res) => res.status(200).send("pong"));

  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        allowedHosts: true
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.use("*", async (req, res) => {
      let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
      template = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    });
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => res.sendFile(path.resolve(__dirname, "dist/index.html")));
  }
  const PORT = process.env.PORT || 5000;

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log("🚀 CStream DEV server on port " + PORT);
  });
}

startServer().catch(console.error);
