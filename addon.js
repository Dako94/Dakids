#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import ytdl from "ytdl-core";

const app = express();
app.use(cors());
app.use(express.json());

// — Redirect HTTP → HTTPS dietro Render —
app.enable("trust proxy");
app.use((req, res, next) => {
  if (req.get("x-forwarded-proto") === "http") {
    const host = req.get("host");
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  }
  next();
});

// — Carica gli episodi da meta.json —
let episodes = [];
try {
  episodes = JSON.parse(fs.readFileSync(path.resolve("./meta.json"), "utf-8"));
  console.log(`✅ Caricati ${episodes.length} episodi da meta.json`);
} catch (err) {
  console.error("❌ Errore leggendo meta.json:", err.message);
}

// — Installation page su “/” —
app.get("/", (req, res) => {
  const baseUrl     = `${req.protocol}://${req.get("host")}`;
  const manifestUrl = `${baseUrl}/manifest.json`;
  const cardsHtml = episodes.map(ep => `
    <div class="card">
      <img src="${ep.poster}" alt="${ep.title}">
      <div class="title">${ep.title}</div>
    </div>
  `).join("");

  res.send(`
    <!DOCTYPE html>
    <html lang="it"><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>Installa Dakids Addon</title>
    <style>
      body { font-family:sans-serif; background:#f0f8ff; text-align:center; padding:2rem; }
      .grid { display:flex; flex-wrap:wrap; gap:1rem; justify-content:center; margin:2rem 0; }
      .card { width:150px; border:2px solid #ddd; border-radius:8px; overflow:hidden;
              background:#fff; box-shadow:0 2px 5px rgba(0,0,0,0.1); }
      .card img { width:100%; display:block; }
      .title { padding:0.5rem; font-size:0.9rem; }
      button { background:#4ecdc4; color:#fff; border:none; padding:0.8rem 1.5rem;
               font-size:1rem; border-radius:25px; cursor:pointer; transition:background 0.2s; }
      button:hover { background:#3bb3a3; }
      #manifest-url { margin-top:1rem; font-family:monospace; color:#555; word-break:break-all; }
    </style>
    </head><body>
      <h1>🎉 Dakids Addon</h1>
      <p>Clicca sui personaggi o copia il manifest:</p>
      <div class="grid">${cardsHtml}</div>
      <button id="copy-btn">📋 Copia Manifest</button>
      <div id="manifest-url"></div>
      <script>
        const btn = document.getElementById("copy-btn");
        const out = document.getElementById("manifest-url");
        const url = "${manifestUrl}";
        btn.addEventListener("click", () => {
          navigator.clipboard.writeText(url)
            .then(() => { btn.textContent="✅ Copiato!"; out.textContent="Manifest: "+url; })
            .catch(() => { out.textContent="Errore copia manifest"; });
        });
      </script>
    </body></html>
  `);
});

// — Manifest route —
app.get("/manifest.json", (_req, res) => {
  res.json({
    id: "com.dakids",
    version: "1.0.0",
    name: "Dakids – Pocoyo 🇮🇹",
    description: "Canale YouTube Pocoyo in italiano",
    types: ["channel"],
    idPrefixes: ["dk"],
    resources: ["catalog","meta","stream"],
    catalogs: [
      { type: "channel", id: "pocoyo", name: "Pocoyo 🇮🇹", extra: [] }
    ]
  });
});

// — Catalog route —
app.get("/catalog/channel/pocoyo.json", (_req, res) => {
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

// — Meta route —
app.get("/meta/channel/dk-pocoyo.json", (_req, res) => {
  const ep = episodes[0] || {};
  res.json({
    meta: {
      id: "dk-pocoyo",
      type: "channel",
      name: "Pocoyo 🇮🇹",
      poster: ep.poster || "",
      description: ep.title || "",
      background: ep.poster || "",
      genres: ["Animation","Kids"]
    }
  });
});

// — Stream route: restituamo **solo iframe** per garantire playback in-app su Web e App —
app.get("/stream/channel/dk-pocoyo.json", (_req, res) => {
  const streams = episodes.map(ep => ({
    title: ep.title,
    iframe: `
      <div style="position:absolute;top:0;left:0;width:100%;height:100%;">
        <iframe
          width="100%" height="100%"
          src="https://www.youtube.com/embed/${ep.youtubeId}?autoplay=1&rel=0"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen>
        </iframe>
      </div>`.trim(),
    behaviorHints: { notWebReady: false }
  }));

  console.log(`🔍 /stream restituisce ${streams.length} iframe`);
  res.json({ streams });
});

// — Avvia il server —
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Dakids Addon attivo su port ${PORT}`));
