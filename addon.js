#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import pkg from "yt-dlp-wrap";
import { fileURLToPath } from "url";
import { dirname } from "path";

const { YtDlpWrap } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
app.use(cors());

// ==========================
// Helper: Safe ID
// ==========================
function safeId(id) {
    if (!id) return "unknown";
    return encodeURIComponent(id.toString().trim());
}

// ==========================
// Configurazione Utente
// ==========================
const userConfig = {
    channels: [
        {
            name: "Pocoyo 🇮🇹 Italiano - Canale Ufficiale",
            id: "UCwQ-5RSINDVfzfxyTtQPSww",
            metasFile: "pocoyo_metas.json",
        },
        {
            name: "Peppa Pig - Official Channel",
            id: "UCAOtE1V7Ots4DjM8JLlrYgg",
            metasFile: "peppapig_metas.json",
        },
    ]
};

// ==========================
// Cache e Metadati
// ==========================
let metaDatabase = [];

function loadMetaDatabase() {
    metaDatabase = [];
    userConfig.channels.forEach(channel => {
        const filePath = path.join(__dirname, channel.metasFile);
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, "utf-8");
            const metas = JSON.parse(data);
            metaDatabase.push({
                id: channel.id,
                name: channel.name,
                metas
            });
        }
    });
}

loadMetaDatabase();

function processMetaDatabase(videos, channelName) {
    return videos.map((video, index) => ({
        id: `dakids-${index}-${safeId(video.id)}`,
        type: "movie",
        name: video.title || "Titolo Sconosciuto",
        poster: `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`,
        background: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
        description: `${video.title || "Video"} - ${video.viewCount || 0} visualizzazioni`,
        runtime: video.duration || "0:00",
        released: video.date || "2025-01-01"
    }));
}

// ==========================
// Manifest
// ==========================
app.get("/manifest.json", (req, res) => {
    res.json({
        id: "dakids-addon",
        version: "1.0.0",
        name: "📺 Dakids Addon",
        description: "Cartoni Pocoyo & Peppa Pig",
        resources: ["catalog", "stream"],
        types: ["movie"],
        catalogs: userConfig.channels.map((channel, index) => ({
            type: "movie",
            id: `channel-${index}`,
            name: channel.name,
            extra: []
        }))
    });
});

// ==========================
// Cataloghi
// ==========================
app.get("/catalog/:type/:id.json", (req, res) => {
    const { type, id } = req.params;
    if (type !== "movie") return res.status(404).send("Catalogo non trovato");

    const index = parseInt(id.replace("channel-", ""));
    const channel = userConfig.channels[index];
    if (!channel) return res.status(404).send("Canale non trovato");

    const channelMeta = metaDatabase.find(m => m.id === channel.id);
    if (!channelMeta) return res.status(404).send("Nessun meta disponibile");

    const metas = processMetaDatabase(channelMeta.metas, channel.name);
    res.json({ metas });
});

// ==========================
// Stream (corretto)
// ==========================
app.get("/stream/:type/:metaId.json", (req, res) => {
    const { type, metaId } = req.params;
    if (type !== "movie") return res.status(404).send("Stream non trovato");

    const match = metaId.match(/^dakids-(\d+)-(.+)$/);
    if (!match) return res.status(404).send("ID non valido");

    const index = parseInt(match[1]);
    const encodedVideoId = match[2];

    const channel = userConfig.channels[index];
    if (!channel) return res.status(404).send("Canale non trovato");

    const channelMeta = metaDatabase.find(m => m.id === channel.id);
    if (!channelMeta) return res.status(404).send("Metadati non trovati");

    // Cerca il video usando l'ID encoded (come è stato salvato nel catalogo)
    const video = channelMeta.metas.find(v => safeId(v.id) === encodedVideoId);
    if (!video) return res.status(404).send("Video non trovato");

    res.json({
        streams: [
            {
                title: "YouTube",
                url: `https://www.youtube.com/watch?v=${video.id}`
            }
        ]
    });
});

// ==========================
// Debug endpoint
// ==========================
app.get("/debug", (req, res) => {
    res.json({
        channels: userConfig.channels,
        metaDatabase: metaDatabase.map(m => ({
            id: m.id,
            videoCount: m.metas.length,
            firstVideo: m.metas[0] ? {
                originalId: m.metas[0].id,
                safeId: safeId(m.metas[0].id),
                generatedId: `dakids-0-${safeId(m.metas[0].id)}`
            } : null
        }))
    });
});

// ==========================
// Health Check
// ==========================
app.get("/health", (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// ==========================
// Dashboard Web
// ==========================
app.get("/", (req, res) => {
    const totalVideos = metaDatabase.reduce((sum, c) => sum + c.metas.length, 0);

    res.send(`
    <html>
    <head>
        <title>Dakids Addon</title>
        <style>
            body { font-family: Arial, sans-serif; background: #fff; padding: 20px; }
            h1 { color: #333; }
            .channel { margin-bottom: 15px; }
            .status { color: green; font-weight: bold; }
            .btn { display:inline-block; margin:5px; padding:6px 12px; background:#007bff; color:white; text-decoration:none; border-radius:4px;}
        </style>
    </head>
    <body>
        <h1>📺 Dakids Addon</h1>
        <p><b>Status:</b> <span class="status">Online ✅</span></p>
        <p><b>Canali:</b> ${userConfig.channels.length}</p>
        <p><b>Video totali:</b> ${totalVideos}</p>
        <p><b>yt-dlp:</b> Non disponibile</p>

        <div>
            <a class="btn" href="/manifest.json">📜 Manifest</a>
            <a class="btn" href="/health">❤️ Health Check</a>
            <a class="btn" href="/debug">🐛 Debug Info</a>
        </div>

        <h2>Canali Disponibili:</h2>
        ${userConfig.channels.map((channel, index) => `
            <div class="channel">
                <b>${channel.name}</b> (${metaDatabase[index]?.metas.length || 0} video)
                - <a href="/catalog/movie/channel-${index}.json" target="_blank">Catalogo</a>
            </div>
        `).join("")}

        <hr>
        <p>Per usare questo addon in Stremio, copia questo URL:<br>
        <code>https://${req.hostname}/manifest.json</code></p>
    </body>
    </html>`);
});

// ==========================
// Error Handling
// ==========================
app.use((req, res) => {
    res.status(404).json({ error: "Endpoint non trovato" });
});

app.use((err, req, res, next) => {
    console.error("Errore del server:", err);
    res.status(500).json({ error: "Errore interno del server", message: err.message });
});

// ==========================
// Start Server
// ==========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Dakids Addon in ascolto su http://localhost:${PORT}`);
});                
