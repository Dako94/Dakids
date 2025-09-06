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

app.enable("trust proxy");
app.use((req, res, next) => {
  if (req.get("x-forwarded-proto") === "http") {
    const host = req.get("host");
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  }
  next();
});

// — Carica episodi —
let episodes = [];
try {
  const raw = fs.readFileSync(path.resolve(__dirname, "meta.json"), "utf-8");
  episodes = JSON.parse(raw);
  console.log(`✅ Caricati ${episodes.length} episodi`);
} catch (err) {
  console.error("❌ Errore meta.json:", err.message);
}

// — Estrai canali unici —
const channels = [...new Set(episodes.map(e => e.channel))];

// — Manifest con cataloghi per ogni canale —
app.get("/manifest.json", (_req, res) => {
  const catalogs = channels.map(channel => ({
    type: "channel",
    id: `dakids-${channel.toLowerCase().replace(/\s+/g, "-")}`,
    name: `Dakids – ${channel}`,
    extra: []
  }));

  res.json({
    id: "com.dakids",
    version: "1.0.0",
    name: "Dakids – Cartoni 🇮🇹",
    description: "Cataloghi separati per ogni canale YouTube",
    types: ["channel"],
    idPrefixes: ["dk"],
    resources: ["catalog", "meta", "stream"],
    catalogs
  });
});

// — Catalog per canale —
app.get("/catalog/channel/:catalogId.json", (req, res) => {
  const channelId = req.params.catalogId.replace("dakids-", "").replace(/-/g, " ").toLowerCase();
  const filtered = episodes.filter(e => e.channel.toLowerCase() === channelId);

  const metas = filtered.map(ep => ({
    id: `dk-${ep.youtubeId}`,
    type: "channel",
    name: ep.title,
    poster: ep.poster,
    description: ep.title,
    genres: ["Animation", "Kids"]
  }));

  res.json({ metas });
});

// — Meta —
app.get("/meta/channel/:id.json", (req, res) => {
  const videoId = req.params.id.replace("dk-", "");
  const ep = episodes.find(e => e.youtubeId === videoId) || {};
  res.json({
    meta: {
      id: `dk-${videoId}`,
      type: "channel",
      name: ep.title || "Dakids",
      poster: ep.poster || "",
      description: ep.title || "",
      background: ep.poster || "",
      genres: ["Animation", "Kids"]
    }
  });
});

// — Serve i video locali —
app.use("/videos", express.static(path.join(__dirname, "videos")));

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

// — Avvia il server —
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dakids Addon attivo su porta ${PORT}`);
});
