#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import YtDlpWrap from "yt-dlp-wrap";

const app = express();
app.use(cors());
app.use(express.json());

const ytDlp = new YtDlpWrap("yt-dlp");

// Verifica versione yt-dlp e fallisci se non presente
ytDlp.execPromise(["--version"])
  .then(v => console.log(`✅ yt-dlp versione ${v.trim()}`))
  .catch(() => {
    console.error("❌ yt-dlp non trovato: installalo con pip3 install yt-dlp");
    process.exit(1);
  });

// Carica episodi da meta.json
let episodes = [];
try {
  episodes = JSON.parse(fs.readFileSync("./meta.json", "utf-8"));
  console.log(`✅ Caricati ${episodes.length} episodi`);
} catch (e) {
  console.error("❌ Errore leggendo meta.json:", e.message);
}

// Ottiene l’URL diretto (o fallback YouTube)
async function getDirectUrl(youtubeId) {
  const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
  try {
    const args = ["-f", "best[ext=mp4]", "-g", videoUrl];
    const out = await ytDlp.execPromise(args);
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
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dakids – Pocoyo 🇮🇹</title>
      <style>
        body { font-family:sans-serif; background:#fffbe6; text-align:center; padding:2rem; }
        h1 { color:#ff6f61; }
        button {
          background:#4ecdc4;color:#fff;border:none;
          padding:10px 20px;border-radius:20px;
          cursor:pointer; margin:1rem 0;
        }
        button:hover { background:#45b3a3; }
        .video { display:inline-block; margin:1rem; width:200px; }
        .video img { width:100%; border-radius:10px; }
        .title { font-size:0.9rem; margin-top:0.5rem; }
      </style>
    </head>
    <body>
      <h1>🎉 Dakids – Pocoyo 🇮🇹</h1>
      <button onclick="navigator.clipboard.writeText('${baseUrl}/manifest.json')">
        📋 Copy Manifest
      </button>
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

// Catalog
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

// Stream: restituisce sempre `url` diretto (mp4 o fallback watch)
app.get("/stream/channel/dk-pocoyo.json", async (req, res) => {
  const streams = await Promise.all(
    episodes.map(async ep => {
      const url = await getDirectUrl(ep.youtubeId);
      return {
        title: ep.title,
        url,
        behaviorHints: { notWebReady: false }
      };
    })
  );
  res.json({ streams });
});

// Avvia server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dakids Addon attivo su http://localhost:${PORT}`);
});
