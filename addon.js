#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json());

app.enable("trust proxy");
app.use((req, res, next) => {
  if (req.get("x-forwarded-proto") === "http") {
    const host = req.get("host");
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  }
  next();
});

// — Carica episodi —
let episodes = [];
try {
  const raw = fs.readFileSync(path.resolve("./meta.json"), "utf-8");
  episodes = JSON.parse(raw);
  console.log(`✅ Caricati ${episodes.length} episodi`);
} catch (err) {
  console.error("❌ Errore meta.json:", err.message);
}

// — Homepage HTML —
app.get("/", (req, res) => {
  const base = `${req.protocol}://${req.get("host")}`;
  const manifest = `${base}/manifest.json`;
  const cardsHtml = episodes.map(ep => `
    <div class="card">
      <img src="${ep.poster}" alt="${ep.title}">
      <div class="title">${ep.title}</div>
    </div>
  `).join("");

  res.send(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1.0">
      <title>Dakids Addon</title>
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
        #manifest-url { margin-top:1rem; font-family:monospace; color:#555; word-break:break-all; }
      </style>
    </head>
    <body>
      <h1>🎉 Dakids Addon</h1>
      <p>Clicca sui personaggi o copia il manifest:</p>
      <div class="grid">${cardsHtml}</div>
      <button id="copy-btn">📋 Copia Manifest</button>
      <div id="manifest-url"></div>
      <script>
        const btn = document.getElementById("copy-btn");
        const out = document.getElementById("manifest-url");
        btn.addEventListener("click", () => {
          navigator.clipboard.writeText("${manifest}")
            .then(() => {
              btn.textContent = "✅ Copiato!";
              out.textContent = "Manifest: ${manifest}";
            })
            .catch(() => {
              out.textContent = "Errore copia manifest.";
            });
        });
      </script>
    </body>
    </html>
  `);
});

// — Manifest —
app.get("/manifest.json", (_req, res) => {
  res.json({
    id: "com.dakids",
    version: "1.0.0",
    name: "Dakids – Cartoni 🇮🇹",
    description: "Personaggi: Pocoyo, Bluey, Peppa Pig, Cocomelon",
    types: ["channel"],
    idPrefixes: ["dk"],
    resources: ["catalog", "meta", "stream"],
    catalogs: [
      { type: "channel", id: "dakids", name: "Dakids 🇮🇹", extra: [] }
    ]
  });
});

// — Catalog —
app.get("/catalog/channel/dakids.json", (_req, res) => {
  const metas = episodes.map(ep => ({
    id: `dk-${ep.youtubeId}`,
    type: "channel",
    name: ep.title,
    poster: ep.poster,
    description: "Episodio per bambini",
    genres: ["Animation", "Kids"]
  }));
  res.json({ metas });
});

// — Meta —
app.get("/meta/channel/:id.json", (req, res) => {
  const videoId = req.params.id.replace("dk-", "");
  const ep = episodes.find(e => e.youtubeId === videoId) || {};
  res.json({
    meta: {
      id: `dk-${videoId}`,
      type: "channel",
      name: ep.title || "Dakids",
      poster: ep.poster || "",
      description: ep.title || "",
      background: ep.poster || "",
      genres: ["Animation", "Kids"]
    }
  });
});

// — Stream —
app.get("/stream/channel/:id.json", async (req, res) => {
  const videoId = req.params.id.replace("dk-", "");
  const ep = episodes.find(e => e.youtubeId === videoId);
  if (!ep) return res.json({ streams: [] });

  const embedUrl = `https://www.youtube.com/embed/${videoId}`;
  res.json({
    streams: [{
      title: ep.title,
      url: embedUrl,
      behaviorHints: { notWebReady: false }
    }]
  });
});

// — Avvia il server —
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dakids Addon attivo su porta ${PORT}`);
});
