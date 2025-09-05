!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import pkg from "yt-dlp-wrap";
const YTDlpWrap = pkg.default;

const app = express();
app.use(cors());
app.use(express.json());

// ===================== CONFIG YT-DLP + COOKIES =====================
const cookiesEnv = process.env.YTDLPCOOKIES || process.env.YOUTUBECOOKIES;
if (cookiesEnv) {
  fs.writeFileSync("/tmp/cookies.txt", cookiesEnv);
  console.log("🍪 Cookies salvati in /tmp/cookies.txt");
}

const ytDlpWrap = new YTDlpWrap("yt-dlp");

ytDlpWrap.execPromise(["--version"])
  .then(v => console.log("✅ yt-dlp versione rilevata:", v.trim()))
  .catch(err => {
    console.error("❌ yt-dlp non trovato o non eseguibile:", err);
    console.error("Assicurati che 'pip install -U yt-dlp' sia nel Build Command di Render");
  });

// ===================== LETTURA META.JSON =====================
let allVideos = [];
try {
  const data = fs.readFileSync("./meta.json", "utf-8");
  allVideos = JSON.parse(data);
  console.log(📦 Caricati ${allVideos.length} video);
} catch (err) {
  console.error("❌ Errore meta.json:", err);
  allVideos = [];
}

// ===================== FUNZIONI =====================
function durationToMinutes(duration) {
  if (!duration || typeof duration !== "string") return 0;
  const parts = duration.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  if (parts.length === 1) return parts[0];
  return 0;
}

function formatDate(date) {
  if (!date || typeof date !== "string") return undefined;
  return date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
}

async function getDirectUrl(youtubeId) {
  try {
    const args = [
      https://www.youtube.com/watch?v=${youtubeId},
      "-f", "best[ext=mp4]",
      "-g"
    ];
    if (cookiesEnv) {
      args.push("--cookies", "/tmp/cookies.txt");
    }
    const output = await ytDlpWrap.execPromise(args);
    return output.trim();
  } catch (err) {
    console.error("❌ Errore yt-dlp durante estrazione URL:", err);
    return null;
  }
}

// ===================== HOME PAGE =====================
app.get("/", (req, res) => {
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('host');
  const baseUrl = ${protocol}://${host};

  res.send(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dakids TV 🎈</title>
      <style>
        body { font-family: 'Comic Sans MS', cursive, sans-serif; background: linear-gradient(to bottom, #fffae3, #ffe4e1); color: #333; text-align: center; padding: 2rem; }
        h1 { color: #ff6f61; font-size: 2.5rem; }
        p { font-size: 1.2rem; }
        button { background: #4ecdc4; color: white; border: none; padding: 15px 25px; font-size: 1.2rem; border-radius: 30px; cursor: pointer; margin-top: 1rem; box-shadow: 0 4px #3bb3a3; }
        button:hover { background: #45b3a3; }
        .video-preview { display: inline-block; margin: 1rem; border: 3px solid #ffd700; border-radius: 15px; overflow: hidden; width: 200px; background: white; }
        .video-preview img { width: 100%; display: block; }
        .video-title { padding: 0.5rem; background: #fffacd; font-size: 1rem; }
      </style>
    </head>
    <body>
      <h1>🎉 Benvenuto su Dakids TV! 🎨</h1>
      <p>Cartoni e video divertenti per bambini 👶📺</p>
      <button onclick="copyManifest()">📜 Copia Manifest Stremio</button>
      <p style="font-size:0.9rem; color:#555;">Poi incollalo in Stremio per aggiungere l'addon</p>
      <hr>
      <h2>📺 Ultimi Video</h2>
      <div>
        ${allVideos.slice(0, 6).map(video => `
          <div class="video-preview">
            <img src="${video.poster || https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg}" alt="${video.name || 'Video'}">
            <div class="video-title">${video.name || 'Senza titolo'}</div>
          </div>
        `).join('')}
      </div>
      <script>
        function copyManifest() {
          navigator.clipboard.writeText("${baseUrl}/manifest.json")
            .then(() => alert("✅ Manifest copiato negli appunti!"))
            .catch(() => alert("❌ Impossibile copiare il manifest"));
        }
      </script>
    </body>
    </html>
  `);
});

// ===================== MANIFEST =====================
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "com.dakids.Stremio",
    version: "3.0.0",
    name: "Dakids",
    description: "Video per bambini - riproduzione diretta da YouTube",
    logo: "https://tuo-dominio.it/media/icon.png",
    background: "https://tuo-dominio.it/media/background.jpg",
    resources: ["catalog", "stream"],
    types: ["channel"],
    idPrefixes: ["dk"],
    catalogs: [
      {
        type: "channel",
        id: "dakids",
        name: "Cartoni per Bambini",
        extra: [{ name: "search", isRequired: false }]
      }
    ]
  });
});

// ===================== CATALOG =====================
app.get("/catalog/channel/dakids.json", (req, res) => {
  const metas = allVideos.map(video => {
    const runtimeInMinutes = durationToMinutes(video.runtime);
    const releasedDate = formatDate(video.released);

    return {
      id: video.id,
      type: "channel",
      name: video.name || "Video senza titolo",
      poster: video.poster || https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg,
      description: video.description || "Nessuna descrizione",
      released: releasedDate,
      runtime: ${Math.floor(runtimeInMinutes)} min,
      genres: video.genres || ["Animation", "Kids"],
      behaviorHints: video.behaviorHints || {}
    };
  });

  res.json({ metas });
});

// ===================== STREAM =====================
app.get("/stream/channel/:videoId.json", async (req, res) => {
  const videoId = req.params.videoId;
  const video = allVideos.find(v => v.id === videoId || dk${v.id} === videoId);

  if (!video || !video.youtubeId) {
    return res.status(404).json({ streams: [] });
  }

  const directUrl = await getDirectUrl(video.youtubeId);

  if (!directUrl) {
    return res.json({
      streams: [{
        title: ${video.name || "Video"} (Apri su YouTube),
        externalUrl: https://www.youtube.com/watch?v=${video.youtubeId},
        behaviorHints: { notWebReady: true }
      }]
    });
  }

  res.json({
    streams: [{
      title: video.name || "Video",
      url: directUrl,
      behaviorHints: {
        notWebReady: false,
        bingeGroup: video.youtubeId
      }
    }]
  });
});

// ===================== SERVER =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(🚀 Dakids Addon running on port ${PORT});
  console.log(📺 Videos disponibili: ${allVideos.length});
  console.log(`🌐 Manifest: http://localhost:${PORT}/manifest.json`);
        });
