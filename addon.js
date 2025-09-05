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
        body {
          font-family: 'Comic Sans MS', cursive, sans-serif;
          background: linear-gradient(to bottom, #fffae3, #ffe4e1);
          color: #333; text-align: center; padding: 2rem;
        }
        h1 { color: #ff6f61; font-size: 2.5rem; }
        p { font-size: 1.2rem; }
        button {
          background: #4ecdc4; color: white; border: none;
          padding: 15px 25px; font-size: 1.2rem;
          border-radius: 30px; cursor: pointer; margin: 1rem 0;
          box-shadow: 0 4px #3bb3a3;
        }
        button:hover { background: #45b3a3; }
        .video-preview {
          display: inline-block; margin: 1rem;
          border: 3px solid #ffd700; border-radius: 15px;
          overflow: hidden; width: 200px; background: white;
        }
        .video-preview img { width: 100%; display: block; }
        .video-title {
          padding: 0.5rem; background: #fffacd; font-size: 1rem;
        }
      </style>
    </head>
    <body>
      <h1>🎉 Benvenuto su Dakids – Pocoyo 🇮🇹</h1>
      <p>Episodi divertenti per bambini 👶📺</p>
      <button onclick="copyManifest()">📜 Copia Manifest</button>
      <p style="font-size:0.9rem; color:#555;">
        Incolla in Stremio questo URL:<br>
        <code>${baseUrl}/manifest.json</code>
      </p>
      <hr>
      <h2>📺 Episodi disponibili</h2>
      <div>
        ${episodes.map(ep => `
          <div class="video-preview">
            <img src="${ep.poster}" alt="${ep.title}">
            <div class="video-title">${ep.title}</div>
          </div>
        `).join("")}
      </div>
      <script>
        function copyManifest() {
          navigator.clipboard.writeText("${baseUrl}/manifest.json")
            .then(() => alert("✅ Manifest copiato!"))
            .catch(() => alert("❌ Errore copia manifest"));
        }
      </script>
    </body>
    </html>
  `);
});

// — Manifest.json —
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "com.dakids",
    version: "1.0.0",
    name: "Dakids",
    description: "Pocoyo 🇮🇹 – Episodi per bambini da YouTube",
    types: ["channel"],
    idPrefixes: ["dk"],
    resources: ["catalog", "meta", "stream"],
    catalogs: [
      {
        type: "channel",
        id: "pocoyo",
        name: "Pocoyo 🇮🇹",
        extra: []
      }
    ]
  });
});

// — Catalog (un solo canale) —
app.get("/catalog/channel/pocoyo.json", (req, res) => {
  res.json({
    metas: [
      {
        id: "dk-pocoyo",
        type: "channel",
        name: "Pocoyo 🇮🇹",
        poster: episodes[0]?.poster || "",
        description: "Episodi divertenti per bambini",
        genres: ["Animation", "Kids"]
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
      genres: ["Animation", "Kids"]
    }
  });
});

// — Stream: embed YouTube su tutte le piattaforme —
app.get("/stream/channel/dk-pocoyo.json", (req, res) => {
  const streams = episodes.map(ep => {
    const embedUrl = `https://www.youtube.com/embed/${ep.youtubeId}?autoplay=1&rel=0`;
    return {
      title: ep.title,
      iframe: `
        <div style="position:absolute;top:0;left:0;width:100%;height:100%;">
          <iframe
            width="100%"
            height="100%"
            src="${embedUrl}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen>
          </iframe>
        </div>`.trim(),
      behaviorHints: { notWebReady: false }
    };
  });

  res.json({ streams });
});

// — Avvia il server —
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dakids Addon attivo su http://localhost:${PORT}`);
});
