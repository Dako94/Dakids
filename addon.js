#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

// — Carica gli episodi da meta.json —
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
          h1 { color: #ff6f61; } 
          .video { display: inline-block; margin: 1rem; width: 200px; }
          .video img { width: 100%; }
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
              <div>${ep.title}</div>
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

// — Stream: usa externalUrl per YouTube —
app.get("/stream/channel/dk-pocoyo.json", (req, res) => {
  const streams = episodes.map(ep => ({
    title: ep.title,
    externalUrl: `https://www.youtube.com/watch?v=${ep.youtubeId}`,
    behaviorHints: { notWebReady: false }
  }));
  res.json({ streams });
});

// — Avvia il server —
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dakids Addon attivo su http://localhost:${PORT}`);
});
