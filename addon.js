#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";           // ← import fetch per seguire redirect
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

// Serve immagini e media
app.use("/media", express.static(path.join(__dirname, "media")));
app.use("/images", express.static(path.join(__dirname, "images")));

// NON serviamo più /videos dal filesystem
// app.use("/videos", express.static(path.join(__dirname, "videos")));

// Redirect HTTP→HTTPS su Render
app.enable("trust proxy");
app.use((req, res, next) => {
  if (req.get("x-forwarded-proto") === "http") {
    const host = req.get("host");
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  }
  next();
});

// Carica meta.json
let seriesList = [];
try {
  const raw = fs.readFileSync(path.resolve(__dirname, "meta.json"), "utf-8");
  seriesList = JSON.parse(raw);
  console.log(`✅ Caricate ${seriesList.length} serie`);
} catch (err) {
  console.error("❌ Errore meta.json:", err.message);
}

// Helper per estrarre tutti gli episodi
function getAllEpisodes() {
  return seriesList.flatMap(series =>
    Array.isArray(series.videos)
      ? series.videos.map(ep => ({
          ...ep,
          channel: series.name || series.id,
          seriesId: series.id
        }))
      : []
  );
}

// Segui redirect e ritorna URL finale
async function resolveFinalUrl(url) {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "manual" });
    if ((res.status === 302 || res.status === 301) && res.headers.get("location")) {
      return res.headers.get("location");
    }
  } catch (err) {
    console.warn("⚠️ Errore follow redirect:", err.message);
  }
  return url;
}

// Homepage
app.get("/", (_req, res) => {
  const base = `${_req.protocol}://${_req.get("host")}`;
  res.send(`
    <html><head><title>Dakids 🇮🇹</title></head>
    <body style="font-family:sans-serif;text-align:center;padding:2rem;">
      <h1>Dakids 🇮🇹</h1>
      <p>Manifest Stremio:</p>
      <code>${base}/manifest.json</code>
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
    logo: "https://dakids.onrender.com/media/icon.png",
    background: "https://dakids.onrender.com/media/background.jpg",
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
  const channels = seriesList.map(s => s.name || s.id);
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

// Meta per ogni canale
app.get("/meta/channel/:id.json", (req, res) => {
  const rawId = req.params.id.replace("dk-", "").replace(/-/g, " ").toLowerCase();
  const allEpisodes = getAllEpisodes();
  const filtered = allEpisodes.filter(
    e => e.channel && e.channel.toLowerCase() === rawId
  );
  const originalChannel = filtered.length > 0 ? filtered[0].channel : rawId;

  const videos = filtered.map(ep => ({
    id: ep.id,
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

// Stream: restituisce direttamente l’URL dell’asset GitHub Release
app.get("/stream/channel/:id.json", async (req, res) => {
  const allEpisodes = getAllEpisodes();
  const ep = allEpisodes.find(e => e.id === req.params.id);
  if (!ep) return res.json({ streams: [] });

  // Prendi sempre il link dal JSON
  let fileUrl = ep.video;

  // Se è un asset GitHub, segui il redirect verso S3
  fileUrl = await resolveFinalUrl(fileUrl);

  res.json({
    streams: [
      {
        title: ep.title,
        url: fileUrl,
        behaviorHints: { notWebReady: false }
      }
    ]
  });
});

// Avvia server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dakids 🇮🇹 Addon attivo su porta ${PORT}`);
});
