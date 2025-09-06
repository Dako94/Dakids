#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

// Serve immagini e video
app.use("/images", express.static(path.join(__dirname, "images")));
app.use("/videos", express.static(path.join(__dirname, "videos")));

// Redirect HTTPS su Render
app.enable("trust proxy");
app.use((req, res, next) => {
  if (req.get("x-forwarded-proto") === "http") {
    const host = req.get("host");
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  }
  next();
});

// Carica episodi
let episodes = [];
try {
  const raw = fs.readFileSync(path.resolve(__dirname, "meta.json"), "utf-8");
  episodes = JSON.parse(raw);
  console.log(`✅ Caricati ${episodes.length} episodi`);
} catch (err) {
  console.error("❌ Errore meta.json:", err.message);
}

// Estrai canali unici
const channels = [...new Set(episodes.map(e => e.channel).filter(Boolean))];

// Homepage HTML
app.get("/", (req, res) => {
  const base = `${req.protocol}://${req.get("host")}`;
  const manifest = `${base}/manifest.json`;
  res.send(`
    <html><head><title>Dakids 🇮🇹</title></head>
    <body style="font-family:sans-serif;text-align:center;padding:2rem;">
      <h1>Dakids 🇮🇹</h1>
      <p>Manifest Stremio:</p>
      <code>${manifest}</code>
    </body></html>
  `);
});

// Manifest
app.get("/manifest.json", (_req, res) => {
  res.json({
    id: "com.dakids",
    version: "1.0.0",
    name: "Dakids 🇮🇹",
    description: "Cartoni per bambini",
    types: ["channel"],
    idPrefixes: ["dk"],
    resources: ["catalog", "meta", "stream"],
    catalogs: [
      {
        type: "channel",
        id: "dakids",
        name: "Dakids 🇮🇹",
        extra: []
      }
    ]
  });
});

// Catalog
app.get("/catalog/channel/dakids.json", (_req, res) => {
  const metas = channels.map(channel => {
    const id = `dk-${channel.toLowerCase().replace(/\s+/g, "-")}`;
    return {
      id,
      type: "channel",
      name: channel,
      poster: `https://dakids.onrender.com/images/${id.replace("dk-", "")}.jpg`,
      description: `Episodi di ${channel}`,
      genres: ["Kids"]
    };
  });
  res.json({ metas });
});

// Meta
app.get("/meta/channel/:id.json", (req, res) => {
  const rawId = req.params.id.replace("dk-", "").replace(/-/g, " ").toLowerCase();
  const filtered = episodes.filter(e => e.channel && e.channel.toLowerCase() === rawId);
  const originalChannel = filtered.length > 0 ? filtered[0].channel : rawId;

  const videos = filtered.map(ep => ({
    id: `dk-${ep.youtubeId}`,
    title: ep.title,
    overview: ep.title,
    thumbnail: ep.poster
  }));

  res.json({
    meta: {
      id: req.params.id,
      type: "channel",
      name: originalChannel,
      poster: `https://dakids.onrender.com/images/${req.params.id.replace("dk-", "")}.jpg`,
      description: `Episodi di ${originalChannel}`,
      videos
    }
  });
});

// Stream
app.get("/stream/channel/:id.json", (req, res) => {
  const videoId = req.params.id.replace("dk-", "");
  const ep = episodes.find(e => e.youtubeId === videoId);
  if (!ep) return res.json({ streams: [] });

  const fileUrl = `https://dakids.onrender.com/videos/${videoId}.mp4`;

  res.json({
    streams: [{
      title: ep.title,
      url: fileUrl,
      behaviorHints: { notWebReady: false }
    }]
  });
});

// Avvia server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dakids 🇮🇹 Addon attivo su porta ${PORT}`);
});
