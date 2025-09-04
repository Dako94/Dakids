#!/usr/bin/env node
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ VIDEO COMPATIBILI CON STREMIO (formato corretto)
const allVideos = [
  {
    "id": "dakids-6V0TR2BMN64", // ✅ DEVE iniziare con "tt"
    "title": "🎨 Dipingi e disegna con Pocoyo!",
    "ytId": "6V0TR2BMN64", // ID YouTube originale
    "duration": "07:32",
    "viewCount": 24476,
    "date": "2024-06-03"
  },
  {
    "id": "dakids-mqNURU6twI", // ✅ DEVE iniziare con "tt"  
    "title": "💖 Il nuovo profumo di Elly!",
    "ytId": "-mqNURU6twI",
    "duration": "01:02:41",
    "viewCount": 11279,
    "date": "2024-07-18"
  },
  {
    "id": "dakids-ucjkAEQWKpg", // ✅ DEVE iniziare con "tt"
    "title": "🚌 Corri fino al traguardo con Pocoyo!",
    "ytId": "ucjkAEQWKpg", 
    "duration": "01:11:12",
    "viewCount": 16882,
    "date": "2024-06-14"
  }
];

// ✅ MANIFEST PER STREMIO
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "dakids.addon",
    version: "1.0.0",
    name: "Dakids TV",
    description: "Cartoni animati per bambini",
    resources: ["catalog", "stream"],
    types: ["movie"],
    catalogs: [
      {
        type: "movie",
        id: "dakids-catalog",
        name: "Pocoyo Cartoons"
      }
    ],
    idPrefixes: ["dakids-"] // ✅ IMPORTANTE: dice a Stremio che i nostri ID iniziano con tt
  });
});

// ✅ CATALOGO PER STREMIO  
app.get("/catalog/movie/dakids-catalog.json", (req, res) => {
  console.log("📦 Serving catalog with", allVideos.length, "videos");
  
  const metas = allVideos.map(video => ({
    id: `dakids-${video.ytId}`, // ✅ USA l'ID che inizia con tt
    type: "movie",
    name: video.title,
    poster: `https://i.ytimg.com/vi/${video.ytId}/maxresdefault.jpg`,
    background: `https://i.ytimg.com/vi/${video.ytId}/hqdefault.jpg`,
    description: `${video.title}\n\n👀 ${video.viewCount} visualizzazioni\n⏱️ ${video.duration}`,
    runtime: video.duration,
    released: video.date,
    genres: ["Animation", "Kids"],
    imdbRating: "7.5"
  }));
  
  res.json({ metas });
});

// ✅ STREAM PER STREMIO
app.get("/stream/movie/:videoId.json", (req, res) => {
  const videoId = req.params.videoId;
  console.log("🎬 Stream request for:", videoId);
  
  // Trova il video per ID Stremio
const video = allVideos.find(v => `dakids-${v.ytId}` === videoId);
  
  if (!video) {
    console.log("❌ Video not found:", videoId);
    return res.status(404).json({ error: "Video not found" });
  }
  
  console.log("✅ Serving stream for:", video.title);
  res.json({
    streams: [{
      title: video.title,
      url: `https://www.youtube.com/watch?v=${video.ytId}`
    }]
  });
});

// ✅ HEALTH CHECK
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    videos: allVideos.length,
    message: "Dakids Addon is running"
  });
});

// ✅ HOMEPAGE con URL dinamici
app.get("/", (req, res) => {
  // Ottieni l'URL base dinamicamente
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;
  
  const html = `
  <!DOCTYPE html>
  <html lang="it">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dakids TV Addon</title>
    <style>
      body { 
        font-family: 'Arial', sans-serif; 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
        color: white; 
        padding: 20px; 
        margin: 0;
        min-height: 100vh;
      }
      .container { 
        max-width: 800px; 
        margin: 0 auto; 
        background: rgba(255,255,255,0.1); 
        padding: 30px; 
        border-radius: 15px; 
        backdrop-filter: blur(10px);
      }
      h1 { text-align: center; font-size: 2.5em; margin-bottom: 10px; }
      .subtitle { text-align: center; font-size: 1.2em; margin-bottom: 30px; opacity: 0.9; }
      .info { background: rgba(0,0,0,0.2); padding: 20px; border-radius: 10px; margin: 20px 0; }
      .endpoint { margin: 10px 0; }
      .endpoint strong { color: #ffd700; }
      .url { 
        background: rgba(0,0,0,0.3); 
        padding: 8px 12px; 
        border-radius: 5px; 
        font-family: monospace; 
        word-break: break-all;
        display: inline-block;
        margin-left: 10px;
      }
      .install-box { 
        background: rgba(255,255,255,0.15); 
        padding: 20px; 
        border-radius: 10px; 
        margin: 30px 0;
        text-align: center;
      }
      .install-url { 
        background: rgba(0,0,0,0.4); 
        padding: 15px; 
        border-radius: 8px; 
        font-family: monospace; 
        font-size: 1.1em;
        word-break: break-all;
        margin: 15px 0;
        border: 2px solid #ffd700;
      }
      .btn { 
        display: inline-block; 
        background: #ffd700; 
        color: #333; 
        padding: 10px 20px; 
        border-radius: 5px; 
        text-decoration: none; 
        margin: 5px; 
        font-weight: bold;
      }
      .btn:hover { background: #ffed4e; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>📺 Dakids TV Addon</h1>
      <div class="subtitle">Cartoni animati per bambini su Stremio</div>
      
      <div class="info">
        <h2>📊 Stato del Servizio</h2>
        <p>✅ <strong>Status:</strong> Online e Funzionante</p>
        <p>🎬 <strong>Video disponibili:</strong> ${allVideos.length}</p>
        <p>🌐 <strong>Server:</strong> ${baseUrl}</p>
      </div>

      <div class="info">
        <h2>🔗 Endpoint API</h2>
        <div class="endpoint">
          <strong>Manifest:</strong> 
          <span class="url">${baseUrl}/manifest.json</span>
        </div>
        <div class="endpoint">
          <strong>Catalog:</strong> 
          <span class="url">${baseUrl}/catalog/movie/dakids-catalog.json</span>
        </div>
        <div class="endpoint">
          <strong>Health:</strong> 
          <span class="url">${baseUrl}/health</span>
        </div>
      </div>

      <div class="install-box">
        <h2>📲 Installa su Stremio</h2>
        <p>Copia questo URL nel tuo client Stremio:</p>
        <div class="install-url">${baseUrl}/manifest.json</div>
        <div style="margin-top: 20px;">
          <a href="${baseUrl}/manifest.json" class="btn" target="_blank">Testa Manifest</a>
          <a href="${baseUrl}/catalog/movie/dakids-catalog.json" class="btn" target="_blank">Testa Catalog</a>
          <a href="${baseUrl}/health" class="btn" target="_blank">Health Check</a>
        </div>
      </div>

      <div class="info">
        <h2>🎥 Video Disponibili</h2>
        ${allVideos.map(video => `
          <div style="margin: 10px 0; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 5px;">
            <strong>${video.title}</strong><br>
            <small>ID: ${video.id} | Durata: ${video.duration} | Views: ${video.viewCount}</small>
          </div>
        `).join('')}
      </div>
    </div>
  </body>
  </html>`;
  
  res.send(html);
});

// ✅ AVVIO SERVER (compatibile con Render)
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Dakids Addon running on port", PORT);
  console.log("📺 Videos:", allVideos.length);
  console.log("🌐 Server ready for deployment");
});
