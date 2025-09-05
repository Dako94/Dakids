#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import ytdl from "ytdl-core";

const app = express();
app.use(cors());
app.use(express.json());

// — Carica episodi da meta.json —
let episodes = [];
try {
  episodes = JSON.parse(fs.readFileSync("./meta.json", "utf-8"));
  console.log(`✅ Caricati ${episodes.length} episodi`);
} catch (err) {
  console.error("❌ Errore leggendo meta.json:", err);
  episodes = [];
}

// — Homepage HTML —
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
          body { font-family: sans-serif; background: #fffbe6; text-align: center; padding: 2rem; }
          button { background: #4ecdc4; color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; }
          button:hover { background: #45b3a3; }
          .video { display: inline-block; margin: 1rem; width: 200px; }
          .video img { width: 100%; border-radius: 10px; }
          .video-title { margin-top: 0.5rem; font-size: 0.9rem; }
        </style>
      </head>
      <body>
        <h1>🎉 Dakids – Pocoyo 🇮🇹</h1>
        <p>Clicca “Copy Manifest” per aggiungere il canale in Stremio</p>
        <button onclick="navigator.clipboard.writeText('${baseUrl}/manifest.json')">
          📋 Copy Manifest
        </button>
        <hr>
        <div>
          ${episodes.map(ep => `
            <div class="video">
              <img src="${ep.poster}" alt="${ep.title}">
              <div class="video-title">${ep.title}</div>
            </div>
          `).join("")}
        </div>
      </body>
    </html>
  `);
});

// — Manifest Stremio —
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

// — Catalog: un solo canale —
app.get("/catalog/channel/pocoyo.json", (req, res) => {
  res.json({
    metas: [{
      id: "dk-pocoyo",
      type: "channel",
      name: "Pocoyo 🇮🇹",
      poster: episodes[0]?.poster || "",
      description: "Episodi divertenti per bambini",
      genres: ["Animation","Kids"]
    }]
  });
});

// — Meta del canale —
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

// — Restituisce URL progressivi o HLS per tutte le piattaforme —
async function resolveStreamUrl(youtubeId) {
  const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
  try {
    const info = await ytdl.getInfo(videoUrl, {
      requestOptions: { headers: { Cookie: process.env.YOUTUBE_COOKIES || "" } }
    });

    // 1. HLS (m3u8) stream
    const hls = ytdl.chooseFormat(info.formats, f =>
      f.mimeType && f.mimeType.includes("mpegurl")
    );
    if (hls && hls.url) {
      console.log(`[STREAM] ${youtubeId} → HLS URL`);
      return hls.url;
    }

    // 2. MP4 progressive stream (audio+video)
    const prog = ytdl.chooseFormat(info.formats, f =>
      f.container === "mp4" && f.hasVideo && f.hasAudio
    );
    if (prog && prog.url) {
      console.log(`[STREAM] ${youtubeId} → MP4 URL`);
      return prog.url;
    }

  } catch (err) {
    console.error(`[ERROR] risolvendo stream ${youtubeId}:`, err.message);
  }

  // 3. Fallback a link standard YouTube (plugin ufficiale)
  return videoUrl;
}

// — Stream: tutti gli episodi —
app.get("/stream/channel/dk-pocoyo.json", async (req, res) => {
  const streams = await Promise.all(
    episodes.map(async ep => {
      const url = await resolveStreamUrl(ep.youtubeId);
      return {
        title: ep.title,
        url,
        behaviorHints: { notWebReady: false }
      };
    })
  );

  res.json({ streams });
});

// — Avvia il server —
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dakids Addon attivo su http://localhost:${PORT}`);
});
