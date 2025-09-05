import express from "express";
import puppeteer from "puppeteer";
import fs from "fs";

const app = express();
const cookies = JSON.parse(fs.readFileSync("./cookies.json", "utf-8"));

app.get("/play/:ytId", async (req, res) => {
  const ytId = req.params.ytId;
  const videoUrl = `https://www.youtube.com/watch?v=${ytId}`;

  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setCookie(...cookies);
    await page.goto(videoUrl, { waitUntil: "networkidle2" });

    const embedUrl = await page.evaluate(() => {
      const iframe = document.querySelector("iframe");
      return iframe ? iframe.src : null;
    });

    await browser.close();

    if (embedUrl) {
      res.redirect(embedUrl);
    } else {
      res.status(404).send("❌ Video non embeddabile");
    }
  } catch (err) {
    console.error("Errore:", err.message);
    res.status(500).send("Errore interno");
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🎯 Proxy attivo su http://localhost:${PORT}`);
});
