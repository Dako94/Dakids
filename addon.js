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

// Costruisce dinamicamente il baseURL (http/https + host)
function getBaseUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}

// Espone statico media e immagini
app.use("/media", express.static(path.join(__dirname, "media")));
app.use("/images", express.static(path.join(__dirname, "images")));

// Forza redirect HTTP → HTTPS (su Render e simili)
app.enable("trust proxy");
app.use((req, res, next) => {
  if (req.get("x-forwarded-proto") === "http") {
    return res.redirect(301, `https://${req.get("host")}${req.originalUrl}`);
  }
  next();
});

// Carica il file meta.json
let seriesList = [];
try {
  const raw = fs.readFileSync(path.join(__dirname, "meta.json"), "utf-8");
  seriesList = JSON.parse(raw);
  console.log(`✅ Caricate ${seriesList.length} serie da meta.json`);
} catch (err) {
  console.error("❌ Errore durante il parsing di meta.json:", err.message);
}

// Ritorna tutti gli episodi in un array flat
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

// Risolve eventuali redirect GitHub Release → S3 restituendo l'URL finale
async function resolveFinalUrl(url) {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "manual" });
    if ((res.status === 301 || res.status === 302) && res.headers.get("location")) {
      return res.headers.get("location");
    }
  } catch (err) {
    console.warn("⚠️ Impossibile seguire redirect per", url, err.message);
  }
  return url;
}

// Homepage informativa
app.get("/", (req, res) => {
  const base = getBaseUrl(req);
  res.send(`
    <html>
      <head><title>Dakids 🇮🇹</title></head>
      <body style="font-family:sans-serif; text-align:center; padding:2rem;">
        <h1>Dakids 🇮🇹</h1>
        <p>Manifest Stremio:</p>
        <code>${base}/manifest.json</code>
      </body>
    </html>
  `);
});

// Manifest Stremio
app.get("/manifest.json", (_req, res) => {
  res.json({
    id: "com.dakids",
    version: "1.0.0",
    name: "Dakids 🇮🇹",
    description: "Cartoni per bambini in italiano",
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

// Catalog: lista di canali
app.get("/catalog/channel/dakids.json", (req, res) => {
  const base = getBaseUrl(req);
  const channels = seriesList.map(s => s.name || s.id);
  const metas = channels.map(channel => {
    const id = `dk-${channel.toLowerCase().replace(/\s+/g, "-")}`;
    const imgName = id.replace("dk-", "");
    return {
      id,
      type: "channel",
      name: channel,
      poster: `${base}/images/${imgName}.jpg`,
      description: `Episodi di ${channel}`,
      genres: ["Kids"]
    };
  });
  res.json({ metas });
});

// Meta per un singolo canale
app.get("/meta/channel/:id.json", (req, res) => {
  const base = getBaseUrl(req);
  const rawId = req.params.id.replace("dk-", "").replace(/-/g, " ").toLowerCase();
  const all = getAllEpisodes();
  const filtered = all.filter(e => e.channel.toLowerCase() === rawId);
  const channelName = filtered.length > 0 ? filtered[0].channel : rawId;
  const posterName = req.params.id.replace("dk-", "");

  const videos = filtered.map(ep => ({
    id: ep.id,
    title: ep.title,
    overview: ep.title,
    thumbnail: `${base}/images/${ep.id.replace("dk--", "")}.jpg`
  }));

  res.json({
    meta: {
      id: req.params.id,
      type: "channel",
      name: channelName,
      poster: `${base}/images/${posterName}.jpg`,
      description: `Episodi di ${channelName}`,
      videos
    }
  });
});

// Stream: restituisce il flusso con link diretto
app.get("/stream/channel/:id.json", async (req, res) => {
  const all = getAllEpisodes();
  const ep = all.find(e => e.id === req.params.id);
  if (!ep) {
    return res.json({ streams: [] });
  }

  let fileUrl = ep.video;
  // Se è GitHub Release asset, segue redirect
  fileUrl = await resolveFinalUrl(fileUrl);

  res.json({
    streams: [
      {
        title: ep.title,
        url: fileUrl,
        subtitles: [],                 // array vuoto, elimina ":null"
        behaviorHints: { notWebReady: false }
      }
    ]
  });
});

// Avvio server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dakids 🇮🇹 Addon in ascolto sulla porta ${PORT}`);
});
