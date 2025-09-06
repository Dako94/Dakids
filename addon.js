#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
  const raw = fs.readFileSync(path.resolve(__dirname, "meta.json"), "utf-8");
  episodes = JSON.parse(raw);
  console.log(`✅ Caricati ${episodes.length} episodi`);
} catch (err) {
  console.error("❌ Errore meta.json:", err.message);
}

// — Estrai canali unici —
const channels = [...new Set(episodes.map(e => e.channel))];

// — Homepage HTML colorata —
app.get("/", (req, res) => {
  const base = `${req.protocol}://${req.get("host")}`;
  const manifest = `${base}/manifest.json`;

  res.send(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1.0">
      <title>Dakids Addon</title>
      <style>
        body {
          margin: 0;
          font-family: 'Segoe UI', sans-serif;
          background: linear-gradient(135deg, #fce4ec, #e0f7fa);
          color: #333;
          text-align: center;
        }
        header {
          background: #00bcd4;
          color: white;
          padding: 2rem 1rem;
          box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        }
        h1 {
          margin: 0;
          font-size: 2.5rem;
        }
        p {
          font-size: 1.2rem;
          margin-top: 0.5rem;
        }
        .container {
          padding: 2rem;
        }
        .card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          padding: 1rem;
          margin: 1rem auto;
          max-width: 400px;
        }
        .card h2 {
          margin: 0;
          font-size: 1.5rem;
          color: #00bcd4;
        }
        .card p {
          margin: 0.5rem 0 0;
          font-size: 1rem;
        }
        button {
          background: #ff4081;
          color: white;
          border: none;
          padding: 0.8rem 1.5rem;
          font-size: 1rem;
          border-radius: 25px;
          cursor: pointer;
          margin-top: 1rem;
        }
        button:hover {
          background: #e91e63;
        }
        #manifest-url {
          margin-top: 1rem;
          font-family: monospace;
          color: #555;
          word-break: break-word;
        }
      </style>
    </head>
    <body>
      <header>
        <h1>Dakids Addon</h1>
        <p>Un solo catalogo con accesso ai canali</p>
      </header>
      <div class="container">
        <div class="card">
          <h2>Manifest Stremio</h2>
          <p>Copia e incolla questo manifest in Stremio</p>
          <button id="copy-btn">📋 Copia Manifest</button>
          <div id="manifest-url">${manifest}</div>
        </div>
      </div>
      <script>
        const btn = document.getElementById("copy-btn");
        const out = document.getElementById("manifest-url");
        btn.addEventListener("click", () => {
          navigator.clipboard.writeText(out.textContent)
            .then(() => {
              btn.textContent = "✅ Copiato!";
            })
            .catch(() => {
              btn.textContent = "❌ Errore copia";
            });
        });
      </script>
    </body>
    </html>
  `);
});

// — Manifest con un solo catalogo —
app.get("/manifest.json", (_req, res) => {
  res.json({
    id: "com.dakids",
    version: "1.0.0",
    name: "Dakids – Cartoni 🇮🇹",
    description: "Un solo catalogo con accesso ai canali",
    types: ["channel"],
    idPrefixes: ["dk"],
    resources: ["catalog", "meta", "stream"],
    catalogs: [
      {
        type: "channel",
        id: "dakids",
        name: "Dakids –",
        extra: []
      }
    ]
  });
});

// — Catalog: mostra solo i canali —
app.get("/catalog/channel/dakids.json", (_req, res) => {
  const metas = channels.map(channel => ({
    id: `dk-${channel.toLowerCase().replace(/\s+/g, "-")}`,
    type: "channel",
    name: channel,
    poster: `https://via.placeholder.com/300x450.png?text=${encodeURIComponent(channel)}`,
    description: `Episodi di ${channel}`,
    genres: ["Kids"]
  }));

  res.json({ metas });
});

// — Meta: restituisce gli episodi di quel canale —
app.get("/meta/channel/:id.json", (req, res) => {
  const channelId = req.params.id.replace("dk-", "").replace(/-/g, " ").toLowerCase();
  const filtered = episodes.filter(e => e.channel.toLowerCase() === channelId);

  const videos = filtered.map(ep => ({
    id: `dk-${ep.youtubeId}`,
    title: ep.title,
    overview: ep.title,
    thumbnail: ep.poster
  }));

  res.json({
    meta: {
      id: req.params.id,
      type: "channel",
      name: channelId,
      poster: `https://via.placeholder.com/300x450.png?text=${encodeURIComponent(channelId)}`,
      description: `Episodi di ${channelId}`,
      videos
    }
  });
});

// — Stream: serve i file mp4 —
app.use("/videos", express.static(path.join(__dirname, "videos")));

app.get("/stream/channel/:id.json", (req, res) => {
  const videoId = req.params.id.replace("dk-", "");
  const ep = episodes.find(e => e.youtubeId === videoId);
  if (!ep) return res.json({ streams: [] });

  const fileUrl = `https://dakids.onrender.com/videos/${videoId}.mp4`;

  res.json({
    streams: [{
      title: ep.title,
      url: fileUrl,
      behaviorHints: { notWebReady: false }
    }]
  });
});

// — Avvia il server —
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dakids Addon attivo su porta ${PORT}`);
});
