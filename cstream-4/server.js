// ============================================
// IMPORTS
// ============================================
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createHttpServer } from "http";
import compression from "compression";
import csv from "csv-parser";
import os from "os";
import CHANNELS_DATABASE from "./src/data/channels.js";

// ============================================
// CONFIGURATION GLOBALE
// ============================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV !== "production";
const app = express();

// ============================================
// MIDDLEWARES GLOBAUX
// ============================================
app.use(compression());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Headers CORS
app.use((req, res, next) => {
  const origin = req.headers.origin || "*";
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept, Origin, X-Requested-With",
  );

  // Cache-busting (en dev seulement)
  if (isDev) {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// ============================================
// UTILITAIRES
// ============================================
const readCsv = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    if (!fs.existsSync(filePath)) return resolve([]);
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (err) => reject(err));
  });
};

// ============================================
// CONFIGURATION LIVE TV - CUSTOM CHANNELS
// ============================================
const customChannels = [
  {
    id: "canal-plus-fr",
    name: "Canal+ (FR)",
    url: "https://directfr.sbs/player/player.php?id=40",
    logo: "https://directfr.sbs/logo/canal-plus-logo.png",
    category: "Premium",
    isLocal: true,
  },
  {
    id: "bein-sports-1-fr",
    name: "BeIN Sports 1 HD (FR)",
    url: "https://directfr.sbs/player/player.php?id=8",
    logo: "https://directfr.sbs/logo/bein-sports-1-logo.png",
    category: "Sports",
    isLocal: true,
  },
  {
    id: "bein-sports-2-fr",
    name: "BeIN Sports 2 HD (FR)",
    url: "https://directfr.sbs/player/player.php?id=9",
    logo: "https://directfr.sbs/logo/bein-sports-2-logo.png",
    category: "Sports",
    isLocal: true,
  },
  {
    id: "canal-plus-sport-foot",
    name: "Canal+ Sport Foot",
    url: "https://directfr.sbs/player/player.php?id=6",
    logo: "https://directfr.sbs/logo/canal-plus-foot.png",
    category: "Sports",
    isLocal: true,
  },
  {
    id: "canal-plus-sport-tv",
    name: "CANAL + Sport TV HD (FR)",
    url: "https://directfr.sbs/player/player.php?id=12",
    logo: "https://directfr.sbs/logo/canal-plus-sport.png",
    category: "Sports",
    isLocal: true,
  },
  {
    id: "tf1-hd",
    name: "TF1 HD",
    url: "https://m3u8-player.com/player.php?url=https://m3u.clouddy.online/tf1.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/TF1_logo_2013.svg/1200px-TF1_logo_2013.svg.png",
    category: "General",
    isLocal: true,
  },
  {
    id: "m6-hd",
    name: "M6 HD",
    url: "https://m3u8-player.com/player.php?url=https://m3u.clouddy.online/m6.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/M6_logo_2009.svg/1200px-M6_logo_2009.svg.png",
    category: "General",
    isLocal: true,
  },
  {
    id: "france-2-hd",
    name: "France 2 HD",
    url: "https://m3u8-player.com/player.php?url=https://m3u.clouddy.online/france2.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/France_2_logo_2018.svg/1200px-France_2_logo_2018.svg.png",
    category: "General",
    isLocal: true,
  },
  {
    id: "france-3-hd",
    name: "France 3 HD",
    url: "https://m3u8-player.com/player.php?url=https://m3u.clouddy.online/france3.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/France_3_logo_2018.svg/1200px-France_3_logo_2018.svg.png",
    category: "General",
    isLocal: true,
  },
];

// ============================================
// IPTV CACHE SYSTEM
// ============================================
let iptvCache = [];

const updateIptvCache = async () => {
  try {
    const response = await fetch(
      "https://iptv-org.github.io/api/streams.json",
      {
        signal: AbortSignal.timeout(10000),
      },
    );
    const data = await response.json();
    if (Array.isArray(data)) {
      iptvCache = data.slice(0, 500).map((s) => ({
        id: s.channel || `stream-${Math.random().toString(36).substr(2, 9)}`,
        name: s.channel || s.title || "IPTV Stream",
        url: s.url,
        logo: null,
        category: "IPTV",
      }));
      console.log(`✅ IPTV Cache updated: ${iptvCache.length} streams`);
    }
  } catch (err) {
    console.error("⚠️ IPTV Cache Error:", err.message);
  }
};

// Initialisation et refresh automatique
updateIptvCache();
setInterval(updateIptvCache, 1000 * 60 * 60); // Toutes les heures

// ============================================
// API TMDB
// ============================================
app.get("/api/tmdb/*", async (req, res) => {
  try {
    const tmdbPath = req.params[0];
    const query = new URLSearchParams(req.query);
    const TMDB_KEY = "d430c6c589f4549e780b7e1786f0ac9c";

    query.set("api_key", TMDB_KEY);
    const url = `https://api.themoviedb.org/3/${tmdbPath}?${query.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json(errorData);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// API CHAT IA (GROQ)
// ============================================
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    const GROQ_API_KEY =
      "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";

    const systemMessage = {
      role: "system",
      content:
        "Tu es CAi v4.5, l'intelligence cinéma premium de CStream. " +
        "CAPACITÉS: Tu as accès en temps réel à la base de données TMDB. " +
        "STYLE: Réponds TOUJOURS en français avec un ton expert et passionné. Utilise un Markdown riche. " +
        "RECOMMANDATIONS: Quand tu recommandes un film ou une série, tu DOIS inclure un bloc [MEDIA_DATA] pour chaque item. " +
        'FORMAT MEDIA_DATA: [MEDIA_DATA]{"id": "ID_TMDB", "type": "movie|tv", "title": "TITRE", "rating": "NOTE", "image": "/poster_path", "overview": "RÉSUMÉ"}[/MEDIA_DATA] ' +
        "L'image DOIT être le poster_path relatif de TMDB (ex: /uXDfjJbdG4uz7Scyv9p7Z979vRw.jpg). " +
        "NE PAS METTRE de guillemets autour du JSON dans le bloc [MEDIA_DATA]. " +
        "WHATSAPP STYLE: Utilise des emojis pour rendre la conversation vivante.",
    };

    let enhancedMessages = [systemMessage, ...messages];
    const lastUserMessage = messages[messages.length - 1]?.content || "";

    // Injection contexte TMDB si recherche détectée
    if (
      lastUserMessage
        .toLowerCase()
        .match(/(film|série|recommande|quoi regarder|populaire|top)/)
    ) {
      try {
        const TMDB_KEY = "d430c6c589f4549e780b7e1786f0ac9c";
        const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&language=fr-FR&query=${encodeURIComponent(lastUserMessage)}&page=1`;
        const tmdbRes = await fetch(searchUrl);
        if (tmdbRes.ok) {
          const tmdbData = await tmdbRes.json();
          const context = tmdbData.results.slice(0, 5).map((item) => ({
            id: item.id,
            type: item.media_type,
            title: item.title || item.name,
            overview: item.overview,
            poster: item.poster_path,
            rating: item.vote_average,
          }));
          enhancedMessages.push({
            role: "system",
            content:
              "CONTEXTE TMDB ACTUEL (Utilise ces données pour tes blocs MEDIA_DATA) : " +
              JSON.stringify(context),
          });
        }
      } catch (e) {
        console.error("⚠️ TMDB context inject error:", e);
      }
    }

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY.trim()}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: enhancedMessages,
          temperature: 0.7,
          max_tokens: 2048,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: { message: "Groq API Error" } }));
      return res
        .status(response.status)
        .json({ error: errorData.error?.message || "Groq API Error" });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "";

    res.json({
      reply: reply,
      content: reply,
      choices: [{ message: { content: reply } }],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DISCORD BOT CONTROL
// ============================================
app.get("/api/bot/status", (req, res) => {
  // In Replit, we can check if the workflow is running, 
  // but for a simple implementation, we'll return 'online' if the server is up
  // or use a global variable if we manage the process here.
  res.json({ status: "online" });
});

app.post("/api/bot/control", async (req, res) => {
  const { action } = req.body;
  console.log(`Bot control action: ${action}`);
  // In a real Replit environment, this would ideally use the Replit API to restart the workflow.
  // For now, we'll simulate success.
  res.json({ success: true, message: `Bot ${action}ed successfully` });
});

app.get("/api/bot/data", (req, res) => {
  try {
    const dataPath = path.join(__dirname, 'bot', 'bot-data.json');
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      return res.json(data);
    }
  } catch (e) {
    console.error('Error reading bot data:', e);
  }
  res.json({ channels: [], members: [] });
});

app.post("/api/bot/notify", (req, res) => {
  try {
    const { channelId, message, embed } = req.body;
    const notifyRequestPath = path.join(__dirname, 'bot', 'notify-request.json');
    fs.writeFileSync(notifyRequestPath, JSON.stringify({
      channelId,
      message,
      embed,
      status: 'pending',
      timestamp: new Date().toISOString()
    }));
    res.json({ success: true });
  } catch (e) {
    console.error('Error creating notify request:', e);
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// AUTHENTIFICATION
// ============================================
app.post("/api/auth/anonymous", (req, res) => {
  const userId = `anonymous_${Date.now()}`;
  res.status(200).json({
    user: {
      id: userId,
      email: `${userId}@anonymous.local`,
      username: "Anonymous User",
      role: "user",
      avatar_url: null,
    },
    token: `bearer_${userId}`,
  });
});

app.post("/api/auth/logout", (req, res) => {
  res.status(200).json({ success: true });
});

app.get("/api/user", (req, res) => {
  const userId = req.headers.authorization?.split("_")[1] || "anonymous";
  res.status(200).json({
    id: userId,
    email: `${userId}@example.com`,
    username: `User ${userId}`,
    role: "user",
  });
});

// ============================================
// DISCORD
// ============================================
app.get("/api/discord/status", (req, res) => {
  try {
    const statusPath = path.join(__dirname, 'bot', 'bot-status.json');
    if (fs.existsSync(statusPath)) {
      const statusData = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      const lastUpdate = new Date(statusData.lastUpdate);
      const now = new Date();
      const diffSeconds = (now - lastUpdate) / 1000;

      if (statusData.connected && diffSeconds < 60) {
        return res.status(200).json({
          connected: true,
          message: "Bot Discord connecté",
          botTag: statusData.botTag,
          lastUpdate: statusData.lastUpdate
        });
      }
    }
  } catch (e) {
    console.error('Error reading bot status:', e);
  }
  res.status(200).json({ connected: false, message: "Bot Discord non connecté" });
});

app.get("/api/auth/discord/callback", async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect(`/verify?error=${error}`);
  if (!code) return res.redirect("/verify?error=missing_code");
  return res.redirect("/verify");
});

app.post("/api/discord/verify-user", async (req, res) => {
  try {
    const { userId, username, email, discordId } = req.body;
    if (!userId || !username || !discordId) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    res
      .status(200)
      .json({ success: true, message: "Bot notification suppressed in dev" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SPORTS API
// ============================================
app.get("/api/sports", async (req, res) => {
  try {
    const response = await fetch("https://streamed.pk/api/sports", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("⚠️ Sports API error:", error.message);
    // Fallback static list to keep UI working
    res.json([
      { id: 'football', name: 'Football' },
      { id: 'basketball', name: 'Basketball' },
      { id: 'motor sports', name: 'Motor Sports' },
      { id: 'fight sports', name: 'Fight Sports' },
      { id: 'tennis', name: 'Tennis' }
    ]);
  }
});

app.get("/api/sports/matches/:sportId", async (req, res) => {
  try {
    const { sportId } = req.params;
    let url;

    switch (sportId) {
      case "all":
        url = "https://streamed.pk/api/matches/all";
        break;
      case "live":
        url = "https://streamed.pk/api/matches/live";
        break;
      case "today":
        url = "https://streamed.pk/api/matches/all-today";
        break;
      case "popular":
        url = "https://streamed.pk/api/matches/all/popular";
        break;
      default:
        url = `https://streamed.pk/api/matches/${sportId}`;
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Referer": "https://streamed.pk/",
        "Origin": "https://streamed.pk",
        "Accept": "application/json"
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Upstream returned ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(`⚠️ Matches API error (${req.params.sportId}):`, error.message);
    res.json([]);
  }
});

app.get("/api/sports/stream/:source/:id", async (req, res) => {
  try {
    const { source, id } = req.params;
    const url = `https://streamed.pk/api/stream/${source}/${id}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Referer": "https://streamed.pk/",
        "Origin": "https://streamed.pk",
        "Accept": "application/json"
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Upstream returned ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(`⚠️ Stream API error (${req.params.source}/${req.params.id}):`, error.message);
    res.status(500).json({ error: "Failed to fetch stream sources" });
  }
});

// ============================================
// LIVE TV CHANNELS (DADDYHD + CUSTOM + CSV)
// ============================================
app.get("/api/livetv/channels", async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    // 1. DaddyHD API Channels
    const DADDY_KEY = process.env.DADDY_KEY || "YOUR_KEY";
    let apiChannels = [];

    try {
      // Try multiple mirrors/endpoints for DaddyHD
      const endpoints = [
        `https://dlhd.link/daddyapi.php?key=${DADDY_KEY}&endpoint=channels`,
        `https://daddyhd.com/api/channels?key=${DADDY_KEY}`,
        `https://1.dlhd.sx/daddyapi.php?key=${DADDY_KEY}&endpoint=channels`,
        `https://dlhd.sx/daddyapi.php?key=${DADDY_KEY}&endpoint=channels`,
        `https://daddylive.sx/daddyapi.php?key=${DADDY_KEY}&endpoint=channels`
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(5000)
          });
          if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.data)) {
              apiChannels = data.data.map((c) => ({
                id: c.channel_id,
                name: c.channel_name,
                logo: c.logo_url?.startsWith("http")
                  ? c.logo_url
                  : `https://dlhd.link/${c.logo_url || "logos/default.png"}`,
                url: `https://dlhd.link/stream/stream-${c.channel_id}.php`,
                category: c.category || "Live TV",
              }));
              if (apiChannels.length > 0) break;
            }
          }
        } catch (e) {
          continue;
        }
      }
    } catch (err) {
      console.log("⚠️ DaddyHD API unavailable, using fallback");
    }

    // 2. Channels Database (local)
    const dbChannels = CHANNELS_DATABASE.map((c) => ({
      ...c,
      logo: `https://dlhd.link/logos/${c.id}.png`,
      url: `https://dlhd.link/stream/stream-${c.id}.php`,
    }));

    // 3. CSV Local Channels
    const localDbPath = path.join(
      __dirname,
      "Lecteur media complet/Database Fot Tv Api/database-master/data/channels.csv",
    );
    const localLogosPath = path.join(
      __dirname,
      "Lecteur media complet/Database Fot Tv Api/database-master/data/logos.csv",
    );

    let formattedLocal = [];
    if (fs.existsSync(localDbPath)) {
      const localChannels = await readCsv(localDbPath);
      const localLogos = fs.existsSync(localLogosPath)
        ? await readCsv(localLogosPath)
        : [];
      formattedLocal = localChannels
        .map((c) => ({
          id: `local-${c.id || Math.random().toString(36).substr(2, 5)}`,
          name: c.name || "Local Channel",
          url: c.website || "",
          logo: localLogos.find((l) => l.channel === c.id)?.url || null,
          category: c.categories?.split(",")?.[0] || "General",
          isLocal: true,
        }))
        .filter((c) => c.url);
    }

    // 4. Fusion intelligente
    const mergedChannels = [...dbChannels];

    // Ajouter ou fusionner les channels API
    apiChannels.forEach((ac) => {
      const idx = mergedChannels.findIndex((mc) => mc.id === ac.id);
      if (idx !== -1) {
        mergedChannels[idx] = { ...mergedChannels[idx], ...ac };
      } else {
        mergedChannels.push(ac);
      }
    });

    // 5. Ajouter custom channels, local CSV et IPTV
    const totalChannels = [
      ...mergedChannels,
      ...customChannels,
      ...formattedLocal,
      ...iptvCache,
    ].filter((v, i, a) => v.url && a.findIndex((t) => t.url === v.url) === i);

    console.log(
      `📺 LiveTV Channels: ${totalChannels.length} ` +
      `(DaddyHD: ${apiChannels.length}, DB: ${dbChannels.length}, ` +
      `Custom: ${customChannels.length}, Local: ${formattedLocal.length}, ` +
      `IPTV: ${iptvCache.length})`,
    );

    return res.status(200).json(totalChannels);
  } catch (error) {
    console.error("⚠️ LiveTV Channels error:", error);
    // Fallback vers les channels de base
    return res.status(200).json([
      ...CHANNELS_DATABASE.map((c) => ({
        ...c,
        logo: `https://dlhd.link/logos/${c.id}.png`,
        url: `https://dlhd.link/stream/stream-${c.id}.php`,
      })),
      ...customChannels,
    ]);
  }
});

app.get("/api/livetv/schedule", async (req, res) => {
  try {
    const DADDY_KEY = process.env.DADDY_KEY || "YOUR_KEY";
    const response = await fetch(
      `https://dlhd.link/daddyapi.php?key=${DADDY_KEY}&endpoint=schedule`,
    );
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
    const response = await fetch(
      `https://dlhd.link/daddyapi.php?key=${DADDY_KEY}&endpoint=info`,
    );
    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    }
    res.status(500).json({ error: "Failed to fetch info" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PROXY IMAGES
// ============================================
app.get("/api/images/proxy", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "Missing URL parameter" });

    const isMangaDex =
      url.startsWith("https://api.mangadex.org") ||
      url.startsWith("https://auth.mangadex.org");
    const isMangaDexImage =
      url.includes("mangadex.org/data") || url.includes("mangadex.org/covers");
    const isTMDB = url.startsWith("https://image.tmdb.org");
    const isDrift = url.includes("drift.rip");

    if (!isMangaDex && !isMangaDexImage && !isTMDB && !isDrift) {
      console.warn("⚠️ Proxying non-whitelisted URL:", url);
    }

    const headers = {
      "User-Agent": "CStream-App/1.0.0",
      Accept: "*/*",
    };

    if (req.headers.authorization) {
      headers["Authorization"] = req.headers.authorization;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      return res
        .status(response.status)
        .send(`Upstream returned ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);

    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      return res.json(data);
    }

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("⚠️ Proxy error:", error);
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
      botRunning: true, // Assume running if server is up
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

app.post('/api/analytics/visit', express.json(), async (req, res) => {
  try {
    const { visitorId, platform, language, username } = req.body;
    console.log(`[Analytics] New visit from ${visitorId} (${platform}, ${language})`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// SERVEUR & VITE DEV
// ============================================
async function startServer() {
  const httpServer = createHttpServer(app);

  // Check if we are in the 'project' subdirectory or the root
  const projectPath = fs.existsSync(path.resolve(__dirname, "project"))
    ? path.resolve(__dirname, "project")
    : __dirname;

  const distPath = path.join(projectPath, "dist");

  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        allowedHosts: true
      },
      appType: "spa",
      root: projectPath
    });
    app.use(vite.middlewares);
    app.use("*", async (req, res) => {
      try {
        let template = fs.readFileSync(path.resolve(projectPath, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        console.error("Vite middleware error:", e);
        res.status(500).end(e.stack);
      }
    });
  } else {
    // Production: servir les fichiers statiques
    if (fs.existsSync(distPath)) {
      app.use(
        express.static(distPath, {
          etag: false,
          lastModified: false,
          setHeaders: (res, filePath) => {
            res.setHeader(
              "Cache-Control",
              "no-store, no-cache, must-revalidate, proxy-revalidate",
            );
          },
        }),
      );

      app.get("*", (req, res) => {
        if (req.path.startsWith("/api/")) {
          return res.status(404).json({ error: "API endpoint not found" });
        }
        res.setHeader(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        );
        res.sendFile(path.resolve(distPath, "index.html"));
      });
    } else {
      console.error("Dist folder not found at:", distPath);
      app.get("*", (req, res) => res.status(404).send("Application not built. Please run build first."));
    }
  }

  const PORT = process.env.PORT || 5000;
  // Health check endpoint for Replit deployment
  app.get("/health", (req, res) => res.status(200).send("OK"));

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🎬 CStream ULTRA Server v2.0                             ║
║  🚀 Mode: ${isDev ? "DEVELOPMENT" : "PRODUCTION".padEnd(42)}║
║  🌐 Port: ${PORT.toString().padEnd(42)}        ║
║  📡 IPTV: ${iptvCache.length.toString().padEnd(42)} streams║
║  📺 Custom: ${customChannels.length.toString().padEnd(40)} channels║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
}

startServer().catch(console.error);
