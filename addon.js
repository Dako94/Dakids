#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import { YtDlpWrap } from "yt-dlp-wrap";

const app = express();
app.use(cors());
app.use(express.json());

// Instanzia YtDlpWrap
// Se hai installato yt-dlp via pip, il binario si chiama "yt-dlp"
const ytDlp = new YtDlpWrap("yt-dlp");

// Verifica che yt-dlp sia disponibile
ytDlp.execPromise(["--version"])
  .then(v => console.log(`✅ yt-dlp versione ${v.trim()}`))
  .catch(err => {
    console.error("❌ yt-dlp non trovato. Installa con `pip3 install yt-dlp`");
    process.exit(1);
  });

// Carica episodi da meta.json
let episodes = [];
try {
  const raw = fs.readFileSync("./meta.json", "utf-8");
  episodes = JSON.parse(raw);
  console.log(`✅ Caricati ${episodes.length} episodi`);
} catch (err) {
  console.error("❌ Errore leggendo meta.json:", err.message);
  episodes = [];
}

// Ottieni URL diretto o fallback a YouTube
async function getDirectUrl(youtubeId) {
  const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
  try {
    // "-g" restituisce solo l'URL del miglior formato disponibile
    const out = await ytDlp.execPromise([videoUrl, "-f", "best[ext=mp4]", "-g"]);
    return out.trim();
  } catch {
    console.warn(`⚠️ Fallback a watch URL per ${youtubeId}`);
    return videoUrl;
  }
}

// Homepage HTML
app.get("/", (req, res) => {
  const proto   = req.get("x-forwarded-proto") || req.protocol;
  const host    = req.get("host");
  const baseUrl = `${proto}://${host}`;

  res.send(`
    <!DOCTYPE html>
    <html lang="it">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dakids – Pocoyo 🇮🇹</title>
      <style>
        body { font-family:sans-serif; background:#fffbe6; text-align:center; padding:2rem; }
        button { background:#4ecdc4;color:#fff;border:none;padding:10px 20px;border-radius:20px;cursor:pointer; }
        button:hover { background:#45b3a3; }
        .video { display:inline-block;margin:1rem;width:200px; }
        .video img { width:100%; border-radius:10px; }
        .title { margin-top:0.5rem;font-size:0.9rem; }
      </style>
      </head>
      <body>
        <h1>🎉 Dakids – Pocoyo 🇮🇹</h1>
        <button onclick="navigator.clipboard.writeText('${baseUrl}/manifest.json')">📋 Copy Manifest</button>
        <hr>
        <div>
          ${episodes.map(ep => `
            <div class="video">
              <img src="${ep.poster}" alt="${ep.title}">
              <div class="title">${ep.title}</div>
            </div>
          `).join("")}
        </div>
      </body>
    </html>
  `);
});

// Manifest Stremio
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

// Catalog: un solo canale
app.get("/catalog/channel/pocoyo.json", (req, res) => {
  res.json({
    metas: [
      {
        id: "dk-pocoyo",
        type: "channel",
        name: "Pocoyo 🇮🇹",
        poster: episodes[0]?.poster || "",
        description: "Episodi divertenti per bambini",
        genres: ["Animation","Kids"]
      }
    ]
  });
});

// Meta del canale
app.get("/meta/channel/dk-pocoyo.json", (req, res) => {
  res.json({
    meta: {
      id: "dk-pocoyo",
      type: "channel",
      name: "Pocoyo 🇮🇹",
      poster: episodes[0]?.poster || "",
      description: "Episodi divertenti per bambini",
      background: episodes[0]?.poster || "",
      genres: ["Animation","Kids"]
    }
  });
});

// Stream: restituisce sempre `url` (mp4 diretto o watch URL)
app.get("/stream/channel/dk-pocoyo.json", async (req, res) => {
  const streams = await Promise.all(
    episodes.map(async ep => ({
      title: ep.title,
      url: await getDirectUrl(ep.youtubeId),
      behaviorHints: { notWebReady: false }
    }))
  );
  res.json({ streams });
});

// Avvia il server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dakids Addon attivo su http://localhost:${PORT}`);
});
