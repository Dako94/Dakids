#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";

// ESM + CommonJS shim: import default export e destruttura
import ytDlpWrapPkg from "yt-dlp-wrap";
const YtDlpWrap = ytDlpWrapPkg.default;

const app = express();
app.use(cors());
app.use(express.json());

// Instanzia yt-dlp (binario installato via pip3)
const ytDlp = new YtDlpWrap("yt-dlp");

// Verifica che yt-dlp sia disponibile
ytDlp.execPromise(["--version"])
  .then(v => console.log(`✅ yt-dlp versione ${v.trim()}`))
  .catch(() => {
    console.error("❌ yt-dlp non trovato. Installa con `pip3 install yt-dlp`");
    process.exit(1);
  });

// Carica episodi da meta.json
let episodes = [];
try {
  episodes = JSON.parse(fs.readFileSync("./meta.json", "utf-8"));
  console.log(`✅ Caricati ${episodes.length} episodi`);
} catch (err) {
  console.error("❌ Errore leggendo meta.json:", err.message);
}

// Ottieni URL diretto (o fallback YouTube)
async function getDirectUrl(youtubeId) {
  const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
  try {
    // "-g" estrae l’URL del miglior formato mp4 disponibile
    const out = await ytDlp.execPromise([videoUrl, "-f", "best[ext=mp4]", "-g"]);
    return out.trim();
  } catch {
    console.warn(`⚠️ Fallback a watch URL per ${youtubeId}`);
    return videoUrl;
  }
}

// Homepage (copia manifest)
app.get("/", (req, res) => {
  const proto   = req.get("x-forwarded-proto") || req.protocol;
  const host    = req.get("host");
  const baseUrl = `${proto}://${host}`;
  res.send(`
    <!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dakids – Pocoyo 🇮🇹</title></head><body>
    <h1>🎉 Dakids – Pocoyo 🇮🇹</h1>
    <p><button onclick="navigator.clipboard.writeText('${baseUrl}/manifest.json')">
      📋 Copy Manifest
    </button></p>
    </body></html>
  `);
});

// Manifest
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "com.dakids",
    version: "1.0.0",
    name: "Dakids",
    description: "Pocoyo 🇮🇹 – Episodi per bambini da YouTube",
    types: ["channel"],
    idPrefixes: ["dk"],
    resources: ["catalog","meta","stream"],
    catalogs: [
      { type: "channel", id: "pocoyo", name: "Pocoyo 🇮🇹", extra: [] }
    ]
  });
});

// Catalog
app.get("/catalog/channel/pocoyo.json", (req, res) => {
  res.json({
    metas: episodes.map((ep, i) => ({
      id: `dk-pocoyo-${i}`,
      type: "movie",
      name: ep.title,
      poster: ep.poster,
      description: ep.title,
      genres: ["Animation", "Kids"]
    }))
  });
});

// Meta
app.get("/meta/channel/dk-pocoyo-0.json", (req, res) => {
  const ep = episodes[0] || {};
  res.json({
    meta: {
      id: "dk-pocoyo-0",
      type: "movie",
      name: ep.title,
      poster: ep.poster,
      description: ep.title,
      background: ep.poster,
      genres: ["Animation", "Kids"]
    }
  });
});

// Stream
app.get("/stream/channel/dk-pocoyo-0.json", async (req, res) => {
  const ep = episodes[0] || {};
  const url = await getDirectUrl(ep.youtubeId);
  res.json({
    streams: [
      {
        title: ep.title,
        url,
        behaviorHints: { notWebReady: false }
      }
    ]
  });
});

// Avvia il server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dakids Addon attivo su http://localhost:${PORT}`);
});
