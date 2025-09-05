#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

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

// — Converte cookies.txt da variabile d’ambiente —
function parseCookiesTxt(raw) {
  const lines = raw.split("\n").filter(l => l && !l.startsWith("#"));
  return lines.map(line => {
    const [domain, flag, path, secure, expiry, name, value] = line.split("\t");
    return {
      domain,
      path,
      name,
      value,
      httpOnly: false,
      secure: secure === "TRUE",
      expires: expiry === "0" ? undefined : Number(expiry)
    };
  });
}

let cookies = [];
try {
  const rawCookiesTxt = process.env.YOUTUBE_COOKIES;
  cookies = parseCookiesTxt(rawCookiesTxt);
  console.log(`🔐 Cookie YouTube caricati da variabile`);
} catch (err) {
  console.error("❌ Errore parsing cookie:", err.message);
}

// — Manifest —
app.get("/manifest.json", (_req, res) => {
  const base = "https://dakids.onrender.com";
  res.json({
    id: "com.dakids",
    version: "1.0.0",
    name: "Dakids – Pocoyo 🇮🇹",
    description: "Canale YouTube Pocoyo in italiano",
    types: ["channel"],
    idPrefixes: ["dk"],
    resources: ["catalog", "meta", "stream"],
    catalogs: [
      { type: "channel", id: "pocoyo", name: "Pocoyo 🇮🇹", extra: [] }
    ]
  });
});

// — Catalog —
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

// — Meta —
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

// — Stream —
app.get("/stream/channel/dk-pocoyo.json", async (_req, res) => {
  const streams = [];

  for (const ep of episodes) {
    try {
      const browser = await puppeteer.launch({ headless: "new" });
      const page = await browser.newPage();
      await page.setCookie(...cookies);
      await page.goto(`https://www.youtube.com/watch?v=${ep.youtubeId}`, { waitUntil: "networkidle2" });

      const embedUrl = await page.evaluate(() => {
        const iframe = document.querySelector("iframe");
        return iframe ? iframe.src : null;
      });

      await browser.close();

      if (embedUrl) {
        streams.push({
          title: ep.title,
          url: embedUrl,
          behaviorHints: { notWebReady: false }
        });
      } else {
        console.warn(`❌ Video non embeddabile: ${ep.title}`);
      }
    } catch (err) {
      console.error(`⚠️ Errore stream ${ep.title}:`, err.message);
    }
  }

  console.log(`🔍 /stream restituisce ${streams.length} stream`);
  res.json({ streams });
});

// — Avvia il server —
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dakids Addon attivo su https://dakids.onrender.com`);
});
