#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import pkg from "yt-dlp-wrap";
const YTDlpWrap = pkg.default;

const app = express();
app.use(cors());
app.use(express.json());

// ===================== CONFIG YT-DLP + COOKIES =====================
const cookiesEnv = process.env.YTDLP_COOKIES;
if (cookiesEnv) {
  fs.writeFileSync("/tmp/cookies.txt", cookiesEnv);
  console.log("✅ Cookies salvati in /tmp/cookies.txt");
}

const ytDlpWrap = new YTDlpWrap("yt-dlp");

ytDlpWrap.execPromise(["--version"])
  .then(v => console.log(`✅ yt-dlp versione: ${v.trim()}`))
  .catch(err => {
    console.error("❌ yt-dlp non trovato:", err);
    console.error("Assicurati che 'pip install -U yt-dlp' sia nel Build Command di Render");
  });

// ===================== LETTURA META.JSON =====================
let episodes = [];
try {
  const data = fs.readFileSync("./meta.json", "utf-8");
  episodes = JSON.parse(data);
  console.log(`📦 Caricati ${episodes.length} episodi`);
} catch (err) {
  console.error("❌ Errore meta.json:", err);
  episodes = [];
}

// ===================== FUNZIONE STREAM =====================
async function getDirectUrl(youtubeId) {
  try {
    const args = [
      `https://www.youtube.com/watch?v=${youtubeId}`,
      "-f", "best[ext=mp4]",
      "-g"
    ];
    if (cookiesEnv) {
      args.push("--cookies", "/tmp/cookies.txt");
    }
    console.log(`▶ yt-dlp args: ${args.join(" ")}`);
    const output = await ytDlpWrap.execPromise(args);
    console.log(`✅ yt-dlp output: ${output.trim()}`);
    return output.trim();
  } catch (err) {
    console.error("❌ yt-dlp error:", err);
    return null;
  }
}

// ===================== HOME PAGE =====================
app.get("/", (req, res) => {
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;

  res.send(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pocoyo 🇮🇹 Addon</title>
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
      <h1>🎉 Benvenuto su Pocoyo 🇮🇹 TV!</h1>
      <p>Episodi divertenti per bambini 👶📺</p>
      <button onclick="copyManifest()">📜 Copia Manifest Stremio</button>
      <p style="font-size:0.9rem; color:#555;">Poi incollalo in Stremio per aggiungere il canale</p>
      <hr>
      <h2>📺 Episodi disponibili</h2>
      <div>
        ${episodes.map(ep => `
          <div class="video-preview">
            <img src="${ep.poster}" alt="${ep.title}">
            <div class="video-title">${ep.title}</div>
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
    id: "com.dakids.pocoyo",
    version: "1.0.0",
    name: "Pocoyo 🇮🇹",
    description: "Episodi divertenti per bambini",
    types: ["channel"],
    idPrefixes: ["dk"],
    resources: ["catalog", "stream"],
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

// ===================== CATALOG =====================
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

// ===================== STREAM =====================
app.get("/stream/channel/dk-pocoyo.json", async (req, res) => {
  const streams = await Promise.all(
    episodes.map(async ep => {
      const url = await getDirectUrl(ep.youtubeId);
      if (!url) {
        return {
          title: `${ep.title} (Apri su YouTube)`,
          externalUrl: `https://www.youtube.com/watch?v=${ep.youtubeId}`,
          behaviorHints: { notWebReady: true }
        };
      }
      return {
        title: ep.title,
        url,
        behaviorHints: { notWebReady: false }
      };
    })
  );

  res.json({ streams });
});

// ===================== SERVER =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Pocoyo Addon attivo su http://localhost:${PORT}`);
});
