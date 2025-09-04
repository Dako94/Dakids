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
            id: "UC2FzT3pYSpC0Z8w6GkzS3Jw",
            channelName: "Pocoyo 🇮🇹 Italiano - Canale Ufficiale", // Nome da matchare nel meta.json
        },
        {
            name: "Peppa Pig - Official Channel",
            id: "UCAOtE1V7Ots4DjM8JLlrYgg",
            channelName: "Peppa Pig - Official Channel", // Nome da matchare nel meta.json
        },
    ]
};

// ==========================
// Cache e Metadati
// ==========================
let metaDatabase = [];
let rawMetaData = [];

function loadMetaDatabase() {
    console.log("🔄 Caricamento meta.json...");
    
    const filePath = path.join(__dirname, "meta.json");
    
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, "utf-8");
            rawMetaData = JSON.parse(data);
            console.log(`✅ Caricati ${rawMetaData.length} video dal meta.json`);
        } else {
            console.log("⚠️ meta.json non trovato, uso fallback hardcoded");
            rawMetaData = getFallbackData();
        }
    } catch (error) {
        console.error("❌ Errore lettura meta.json:", error);
        rawMetaData = getFallbackData();
    }

    // Raggruppa i video per canale
    metaDatabase = [];
    userConfig.channels.forEach(channel => {
        const channelVideos = rawMetaData.filter(video => 
            video.channelName === channel.channelName
        );
        
        metaDatabase.push({
            id: channel.id,
            name: channel.name,
            metas: channelVideos
        });
        
        console.log(`📺 ${channel.name}: ${channelVideos.length} video`);
    });
}

// Fallback per test se meta.json non esiste
function getFallbackData() {
    console.log("🔧 Usando dati di fallback per test");
    return [
        {
            "title": "🎨 Video di Test Pocoyo",
            "id": "dQw4w9WgXcQ",
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "viewCount": 1000000,
            "date": "2025-01-01T12:00:00.000Z",
            "likes": 100,
            "channelName": "Pocoyo 🇮🇹 Italiano - Canale Ufficiale",
            "channelUrl": "https://www.youtube.com/channel/test",
            "numberOfSubscribers": 828000,
            "duration": "00:03:32"
        },
        {
            "title": "🐷 Video di Test Peppa Pig",
            "id": "dQw4w9WgXcQ",
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "viewCount": 2000000,
            "date": "2025-01-01T12:00:00.000Z",
            "likes": 200,
            "channelName": "Peppa Pig - Official Channel",
            "channelUrl": "https://www.youtube.com/channel/test",
            "numberOfSubscribers": 500000,
            "duration": "00:05:15"
        }
    ];
}

loadMetaDatabase();

function processMetaDatabase(videos, channelName) {
    return videos.map((video, index) => ({
        id: `dakids-${userConfig.channels.findIndex(c => c.name === channelName)}-${safeId(video.id)}`,
        type: "movie",
        name: video.title || "Titolo Sconosciuto",
        poster: `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`,
        background: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
        description: `${video.title || "Video"} - ${video.viewCount ? video.viewCount.toLocaleString() : 0} visualizzazioni\n\n📅 ${video.date ? new Date(video.date).toLocaleDateString('it-IT') : 'Data sconosciuta'}\n⏱️ Durata: ${video.duration || "N/A"}`,
        runtime: video.duration || "0:00",
        released: video.date ? new Date(video.date).getFullYear().toString() : "2025",
        genre: ["Bambini", "Cartoni Animati"],
        imdbRating: Math.min(9.5, Math.max(7.0, (video.likes || 50) / 10)).toFixed(1)
    }));
}

// ==========================
// Manifest
// ==========================
app.get("/manifest.json", (req, res) => {
    console.log("📋 Richiesta manifest.json");
    res.json({
        id: "dakids-addon",
        version: "1.0.1",
        name: "📺 Dakids Addon",
        description: "Cartoni Pocoyo & Peppa Pig - I migliori episodi per bambini",
        logo: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
        resources: ["catalog", "stream"],
        types: ["movie"],
        catalogs: userConfig.channels.map((channel, index) => ({
            type: "movie",
            id: `channel-${index}`,
            name: channel.name,
            extra: [
                {
                    name: "genre",
                    options: ["Bambini", "Educativo", "Divertimento"]
                }
            ]
        }))
    });
});

// ==========================
// Cataloghi
// ==========================
app.get("/catalog/:type/:id.json", (req, res) => {
    const { type, id } = req.params;
    console.log(`📚 Richiesta catalogo: ${type}/${id}`);
    
    if (type !== "movie") {
        console.log("❌ Tipo non supportato:", type);
        return res.status(404).json({ error: "Tipo catalogo non supportato" });
    }

    const index = parseInt(id.replace("channel-", ""));
    const channel = userConfig.channels[index];
    
    if (!channel) {
        console.log("❌ Canale non trovato, index:", index);
        return res.status(404).json({ error: "Canale non trovato" });
    }

    const channelMeta = metaDatabase.find(m => m.id === channel.id);
    
    if (!channelMeta || !channelMeta.metas || channelMeta.metas.length === 0) {
        console.log("⚠️ Nessun meta disponibile per:", channel.name);
        return res.json({ 
            metas: [], 
            message: "Nessun contenuto disponibile per questo canale" 
        });
    }

    const metas = processMetaDatabase(channelMeta.metas, channel.name);
    console.log(`✅ Restituiti ${metas.length} video per ${channel.name}`);
    
    res.json({ metas });
});

// ==========================
// Stream
// ==========================
app.get("/stream/:type/:metaId.json", (req, res) => {
    const { type, metaId } = req.params;
    console.log(`🎥 Richiesta stream: ${type}/${metaId}`);
    
    if (type !== "movie") {
        return res.status(404).json({ error: "Tipo stream non supportato" });
    }

    const match = metaId.match(/^dakids-(\d+)-(.+)$/);
    if (!match) {
        console.log("❌ ID non valido:", metaId);
        return res.status(404).json({ error: "Formato ID non valido" });
    }

    const channelIndex = parseInt(match[1]);
    const videoId = decodeURIComponent(match[2]);
    
    console.log(`🔍 Cerco video: channelIndex=${channelIndex}, videoId=${videoId}`);

    const channel = userConfig.channels[channelIndex];
    if (!channel) {
        return res.status(404).json({ error: "Canale non trovato" });
    }

    const channelMeta = metaDatabase.find(m => m.id === channel.id);
    if (!channelMeta) {
        return res.status(404).json({ error: "Metadati canale non trovati" });
    }

    const video = channelMeta.metas.find(v => safeId(v.id) === safeId(videoId));
    if (!video) {
        console.log("❌ Video non trovato:", videoId);
        return res.status(404).json({ error: "Video non trovato" });
    }

    console.log(`✅ Stream trovato: ${video.title}`);

    res.json({
        streams: [
            {
                title: `📺 ${video.title}`,
                url: `https://www.youtube.com/watch?v=${video.id}`,
                ytId: video.id,
                quality: "HD",
                description: `👀 ${video.viewCount ? video.viewCount.toLocaleString() : 0} visualizzazioni | ⏱️ ${video.duration || "N/A"}`
            }
        ]
    });
});

// ==========================
// Health Check
// ==========================
app.get("/health", (req, res) => {
    const totalVideos = metaDatabase.reduce((sum, c) => sum + c.metas.length, 0);
    res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        channels: userConfig.channels.length,
        totalVideos: totalVideos,
        database: metaDatabase.map(db => ({
            name: db.name,
            videoCount: db.metas.length
        }))
    });
});

// ==========================
// Dashboard Web
// ==========================
app.get("/", (req, res) => {
    const totalVideos = metaDatabase.reduce((sum, c) => sum + c.metas.length, 0);
    const deployUrl = `https://${req.hostname}`;

    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>📺 Dakids Addon</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                min-height: 100vh;
                padding: 20px;
            }
            .container { max-width: 800px; margin: 0 auto; }
            h1 { font-size: 2.5rem; margin-bottom: 10px; text-align: center; }
            .subtitle { text-align: center; opacity: 0.9; margin-bottom: 30px; }
            .card { 
                background: rgba(255,255,255,0.1); 
                backdrop-filter: blur(10px);
                border-radius: 15px; 
                padding: 25px; 
                margin-bottom: 20px;
                border: 1px solid rgba(255,255,255,0.2);
            }
            .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; }
            .stat { text-align: center; }
            .stat-number { font-size: 2rem; font-weight: bold; display: block; }
            .stat-label { opacity: 0.8; font-size: 0.9rem; }
            .btn { 
                display: inline-block; 
                margin: 5px; 
                padding: 10px 20px; 
                background: rgba(255,255,255,0.2); 
                color: white; 
                text-decoration: none; 
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.3);
                transition: all 0.3s ease;
            }
            .btn:hover { background: rgba(255,255,255,0.3); transform: translateY(-2px); }
            .btn-primary { background: #4CAF50; border-color: #4CAF50; }
            .channel { 
                display: flex; 
                justify-content: space-between; 
                align-items: center;
                padding: 15px;
                background: rgba(255,255,255,0.1);
                border-radius: 10px;
                margin-bottom: 10px;
            }
            .channel-info { flex: 1; }
            .channel-name { font-weight: bold; margin-bottom: 5px; }
            .channel-count { opacity: 0.8; font-size: 0.9rem; }
            .install-url { 
                background: rgba(0,0,0,0.3); 
                padding: 15px; 
                border-radius: 8px; 
                word-break: break-all;
                font-family: monospace;
                font-size: 0.9rem;
            }
            @media (max-width: 600px) {
                h1 { font-size: 2rem; }
                .stats { grid-template-columns: repeat(2, 1fr); }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>📺 Dakids Addon</h1>
            <p class="subtitle">I migliori cartoni animati per bambini</p>

            <div class="card">
                <div class="stats">
                    <div class="stat">
                        <span class="stat-number">${userConfig.channels.length}</span>
                        <span class="stat-label">Canali</span>
                    </div>
                    <div class="stat">
                        <span class="stat-number">${totalVideos}</span>
                        <span class="stat-label">Video Totali</span>
                    </div>
                    <div class="stat">
                        <span class="stat-number">✅</span>
                        <span class="stat-label">Online</span>
                    </div>
                </div>

                <div style="text-align: center;">
                    <a class="btn" href="/manifest.json" target="_blank">📜 Manifest</a>
                    <a class="btn" href="/health" target="_blank">❤️ Health Check</a>
                </div>
            </div>

            <div class="card">
                <h2 style="margin-bottom: 20px;">🎬 Canali Disponibili</h2>
                ${userConfig.channels.map((channel, index) => {
                    const channelData = metaDatabase.find(m => m.id === channel.id);
                    const videoCount = channelData ? channelData.metas.length : 0;
                    return `
                        <div class="channel">
                            <div class="channel-info">
                                <div class="channel-name">${channel.name}</div>
                                <div class="channel-count">${videoCount} video disponibili</div>
                            </div>
                            <a href="/catalog/movie/channel-${index}.json" target="_blank" class="btn">Vedi Catalogo</a>
                        </div>
                    `;
                }).join("")}
            </div>

            <div class="card">
                <h2 style="margin-bottom: 15px;">🚀 Installa in Stremio</h2>
                <p style="margin-bottom: 15px;">Copia questo URL e aggiungilo come addon in Stremio:</p>
                <div class="install-url">${deployUrl}/manifest.json</div>
                <br>
                <a href="stremio://${req.hostname}/manifest.json" class="btn btn-primary">📱 Apri in Stremio</a>
            </div>
        </div>
    </body>
    </html>`);
});

// ==========================
// Error Handling
// ==========================
app.use((req, res) => {
    console.log(`❌ 404: ${req.method} ${req.url}`);
    res.status(404).json({ 
        error: "Endpoint non trovato", 
        path: req.url,
        availableEndpoints: [
            "/manifest.json",
            "/catalog/movie/channel-0.json",
            "/catalog/movie/channel-1.json", 
            "/health",
            "/"
        ]
    });
});

app.use((err, req, res, next) => {
    console.error("❌ Errore del server:", err);
    res.status(500).json({ 
        error: "Errore interno del server", 
        message: err.message 
    });
});

// ==========================
// Start Server
// ==========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 Dakids Addon avviato!`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`📜 Manifest: http://localhost:${PORT}/manifest.json`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`\n📺 Canali configurati: ${userConfig.channels.length}`);
    console.log(`🎬 Video totali: ${metaDatabase.reduce((sum, c) => sum + c.metas.length, 0)}\n`);
});
