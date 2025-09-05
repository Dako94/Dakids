#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { exec } from "youtube-dl-exec";

const app = express();
app.use(cors());
app.use(express.json());

// — Redirect HTTP → HTTPS (dietro Render) —
app.enable("trust proxy");
app.use((req, res, next) => {
  if (req.get("x-forwarded-proto") === "http") {
    const host = req.get("host");
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  }
  next();
});

// — Carica lista episodi da meta.json —
let episodes = [];
try {
  const raw = fs.readFileSync(path.resolve("./meta.json"), "utf-8");
  episodes = JSON.parse(raw);
  console.log(`✅ Caricati ${episodes.length} episodi da meta.json`);
} catch (err) {
  console.error("❌ Errore leggendo meta.json:", err.message);
}

// — Pagina di installazione su “/” —
app.get("/", (req, res) => {
  const base     = `${req.protocol}://${req.get("host")}`;
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

// — Manifest.json —
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

// — Catalog/channel/pocoyo.json —
app.get("/catalog/channel/pocoyo.json", (_req, res) => {
  const poster = episodes[0]?.poster || "";
  res.json({
    metas: [
      {
        id: "dk-pocoyo",
        type: "channel",
        name: "Pocoyo 🇮🇹",
        poster,
        description: "Episodi divertenti per bambini",
        genres: ["Animation", "Kids"]
      }
    ]
  });
});

// — Meta/channel/dk-pocoyo.json —
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
      genres: ["Animation", "Kids"]
    }
  });
});

// — Stream/channel/dk-pocoyo.json con yt-dlp —
app.get("/stream/channel/dk-pocoyo.json", async (_req, res) => {
  const streams = await Promise.all(episodes.map(async (ep) => {
    try {
      const info = await exec(
        `https://www.youtube.com/watch?v=${ep.youtubeId}`,
        {
          dumpSingleJson: true,
          noCheckCertificates: true,
          noWarnings: true,
          preferFreeFormats: true,
          addHeader: ["referer:youtube.com", "user-agent:googlebot"]
        }
      );

      // prendi la migliore qualità mp4/mp4a
      const format = info.formats.find(f => f.url && f.vcodec !== "none");
      return {
        title: ep.title,
        url: format?.url || `https://www.youtube.com/watch?v=${ep.youtubeId}`,
        behaviorHints: { notWebReady: false }
      };
    } catch (err) {
      console.error("Errore yt-dlp:", err.message);
      return {
        title: ep.title,
        externalUrl: `https://www.youtube.com/watch?v=${ep.youtubeId}`
      };
    }
  }));

  console.log(`🔍 /stream restituisce ${streams.length} stream`);
  res.json({ streams });
});

// — Avvia il server —
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dakids Addon attivo su http://localhost:${PORT}`);
});
