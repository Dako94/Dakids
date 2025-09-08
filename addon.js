#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

// helper per costruire baseURL dinamico
function getBaseUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}

// statico per media/images
app.use("/media", express.static(path.join(__dirname, "media")));
app.use("/images", express.static(path.join(__dirname, "images")));

// redirect HTTP→HTTPS (Render)
app.enable("trust proxy");
app.use((req, res, next) => {
  if (req.get("x-forwarded-proto") === "http") {
    return res.redirect(301, `https://${req.get("host")}${req.originalUrl}`);
  }
  next();
});

// carica serie da meta.json
let seriesList = [];
try {
  const raw = fs.readFileSync(path.resolve(__dirname, "meta.json"), "utf-8");
  seriesList = JSON.parse(raw);
  console.log(`✅ Caricate ${seriesList.length} serie`);
} catch (err) {
  console.error("❌ Errore meta.json:", err.message);
}

// tutti gli episodi in un array flat
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

// segue i redirect di GitHub Release → S3
async function resolveFinalUrl(url) {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "manual" });
    if ((res.status === 301 || res.status === 302) && res.headers.get("location")) {
      return res.headers.get("location");
    }
  } catch (e) {
    console.warn("⚠️ Errore HEAD redirect:", e.message);
  }
  return url;
}

// Homepage
app.get("/", (req, res) => {
  const base = getBaseUrl(req);
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
      { type: "channel", id: "dakids", name: "Dakids 🇮🇹", extra: [] }
    ]
  });
});

// Catalog
app.get("/catalog/channel/dakids.json", (req, res) => {
  const base = getBaseUrl(req);
  const channels = seriesList.map(s => s.name || s.id);
  const metas = channels.map(channel => {
    const id = `dk-${channel.toLowerCase().replace(/\s+/g, "-")}`;
    const filename = id.replace("dk-", "");
    return {
      id,
      type: "channel",
      name: channel,
      poster: `${base}/images/${filename}.jpg`,
      description: `Episodi di ${channel}`,
      genres: ["Kids"]
    };
  });
  res.json({ metas });
});

// Meta per canale
app.get("/meta/channel/:id.json", (req, res) => {
  const base = getBaseUrl(req);
  const rawId = req.params.id.replace("dk-", "").replace(/-/g, " ").toLowerCase();
  const all = getAllEpisodes();
  const filtered = all.filter(e => e.channel.toLowerCase() === rawId);
  const origChannel = filtered.length > 0 ? filtered[0].channel : rawId;

  const videos = filtered.map(ep => {
    const thumbUrl = ep.poster.startsWith("http")
      ? ep.poster
      : `${base}/images/${req.params.id.replace("dk-", "")}.jpg`;
    return {
      id: ep.id,
      title: ep.title,
      overview: ep.title,
      thumbnail: thumbUrl
    };
  });

  res.json({
    meta: {
      id: req.params.id,
      type: "channel",
      name: origChannel,
      poster: `${base}/images/${req.params.id.replace("dk-", "")}.jpg`,
      description: `Episodi di ${origChannel}`,
      videos
    }
  });
});

// Stream
app.get("/stream/channel/:id.json", async (req, res) => {
  const all = getAllEpisodes();
  const ep = all.find(e => e.id === req.params.id);
  if (!ep) return res.json({ streams: [] });

  let fileUrl = ep.video;
  fileUrl = await resolveFinalUrl(fileUrl);

  res.json({
    streams: [
      {
        title: ep.title,
        subtitle: "",              // <— evita il “:null”
        url: fileUrl,
        behaviorHints: { notWebReady: false }
      }
    ]
  });
});

// Avvia
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dakids 🇮🇹 Addon attivo su porta ${PORT}`);
});
