import express from "express";
import cors from "cors";
import fs from "fs";
import pkg from "yt-dlp-wrap";
const YTDlpWrap = pkg.default;

const app = express();
app.use(cors());

const ytDlpWrap = new YTDlpWrap("yt-dlp");
const cookiesEnv = process.env.YTDLP_COOKIES;
if (cookiesEnv) fs.writeFileSync("/tmp/cookies.txt", cookiesEnv);

let episodes = [];
try {
  const raw = fs.readFileSync("./meta.json", "utf-8");
  episodes = JSON.parse(raw);
  console.log(`✅ Caricati ${episodes.length} episodi`);
} catch (err) {
  console.error("❌ Errore meta.json:", err);
}

async function getDirectUrl(youtubeId) {
  try {
    const args = [`https://www.youtube.com/watch?v=${youtubeId}`, "-f", "best[ext=mp4]", "-g"];
    if (cookiesEnv) args.push("--cookies", "/tmp/cookies.txt");
    const output = await ytDlpWrap.execPromise(args);
    return output.trim();
  } catch (err) {
    console.error("❌ yt-dlp error:", err);
    return null;
  }
}

// Manifest
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

// Catalog — mostra solo il canale
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

// Stream — restituisce tutti gli episodi
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

// Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Pocoyo Addon attivo su http://localhost:${PORT}`);
});
