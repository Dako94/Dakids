#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import ytdl from "ytdl-core";

const app = express();
app.use(cors());
app.use(express.json());

// 1) HTTP → HTTPS dietro Render
app.enable("trust proxy");
app.use((req, res, next) => {
  if (req.get("x-forwarded-proto") === "http") {
    return res.redirect(301, `https://${req.get("host")}${req.originalUrl}`);
  }
  next();
});

// 2) Carica episodi
const metaPath = path.resolve("./meta.json");
let episodes = [];
try {
  episodes = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  console.log(`✅ Caricati ${episodes.length} episodi da meta.json`);
} catch (err) {
  console.error("❌ Errore leggendo meta.json:", err.message);
}

// 3) Root → pagina di installazione
app.get("/", (req, res) => {
  const base     = `${req.protocol}://${req.get("host")}`;
  const manifest = `${base}/manifest.json`;
  const cards = episodes.map(ep => `
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
               font-size:1rem; border-radius:25px; cursor:pointer; }
      button:hover { background:#3bb3a3; }
      #url { margin-top:1rem; font-family:monospace; color:#555; word-break:break-all; }
    </style>
  </head><body>
    <h1>🎉 Dakids Addon</h1>
    <p>Clicca sui personaggi o copia il manifest:</p>
    <div class="grid">${cards}</div>
    <button id="btn">📋 Copia Manifest</button>
    <div id="url"></div>
    <script>
      const btn = document.getElementById("btn"), out = document.getElementById("url");
      btn.onclick = () => {
        navigator.clipboard.writeText("${manifest}")
          .then(_=> { btn.textContent="✅ Copiato!"; out.textContent="Manifest: ${manifest}"; })
          .catch(_=> out.textContent="Errore copia manifest");
      };
    </script>
  </body></html>
  `);
});

// 4) Manifest route
app.get("/manifest.json", (_req, res) => {
  res.json({
    id: "com.dakids",
    version: "1.0.0",
    name: "Dakids – Pocoyo 🇮🇹",
    description: "Episodi Pocoyo in italiano da YouTube",
    types: ["movie"],
    idPrefixes: ["dk"],
    resources: ["catalog","meta","stream"],
    catalogs: [
      { type: "movie", id: "pocoyo", name: "Pocoyo 🇮🇹", extra: [] }
    ]
  });
});

// 5) Catalog route
app.get("/catalog/movie/pocoyo.json", (_req, res) => {
  res.json({
    metas: episodes.map(ep => ({
      id: `dk-${ep.youtubeId}`,
      type: "movie",
      name: ep.title,
      poster: ep.poster,
      description: ep.title,
      genres: ["Animation","Kids"]
    }))
  });
});

// 6) Meta route
app.get("/meta/movie/:id.json", (req, res) => {
  const id = req.params.id;          // "dk-<youtubeId>"
  const you = id.replace(/^dk-/, "");
  const ep  = episodes.find(e => e.youtubeId === you);
  if (!ep) return res.sendStatus(404);

  res.json({
    meta: {
      id,
      type: "movie",
      name: ep.title,
      poster: ep.poster,
      background: ep.poster,
      description: ep.title,
      genres: ["Animation","Kids"]
    }
  });
});

// 7) Stream route
app.get("/stream/movie/:id.json", async (req, res) => {
  const id = req.params.id.replace(/^dk-/, "");
  const videoUrl = `https://www.youtube.com/watch?v=${id}`;
  let direct = videoUrl;

  try {
    const info = await ytdl.getInfo(videoUrl);
    // preferisci HLS
    direct = ytdl.chooseFormat(info.formats, f =>
      f.mimeType?.includes("mpegurl")
    )?.url
      // o altrimenti MP4 audio+video
      || ytdl.chooseFormat(info.formats, f =>
        f.container === "mp4" && f.hasVideo && f.hasAudio
      )?.url
      || direct;
  } catch (e) {
    console.warn("⚠️ ytdl-core errore:", e.message);
  }

  // iframe per Web
  const embed = `
    <div style="position:absolute;top:0;left:0;width:100%;height:100%;">
      <iframe width="100%" height="100%"
        src="https://www.youtube.com/embed/${id}?autoplay=1&rel=0"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media;
               gyroscope; picture-in-picture; web-share"
        allowfullscreen>
      </iframe>
    </div>`.trim();

  res.json({
    streams: [
      {
        title: episodes.find(e => e.youtubeId === id)?.title || "Video",
        url: direct,              // App/TV/Desktop
        iframe: embed,            // Web
        behaviorHints: { notWebReady: false }
      }
    ]
  });
});

// 8) Avvia server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Dakids Addon attivo su http://localhost:${PORT}`)
);
