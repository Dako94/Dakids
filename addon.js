#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
app.use(cors());
app.use(express.json());

// Configurazione AGGIORNATA con i veri ID dei canali dal tuo meta.json
const userConfig = {
    channels: [
        {
            name: "Pocoyo 🇮🇹 Italiano - Canale Ufficiale",
            id: "UCwQ-5RSINDVfzfxyTtQPSww", // Questo è l'ID reale dai tuoi video
        },
        {
            name: "Peppa Pig - Official Channel", 
            id: "UCwQ-5RSINDVfzfxyTtQPSww", // STESSO ID perché hai solo video Pocoyo
            enabled: false // Disabilita perché non hai video Peppa Pig
        },
    ]
};

// Verifica presenza cookies.txt
const cookiesPath = path.join(__dirname, "cookies.txt");
const hasCookies = fs.existsSync(cookiesPath);
if (hasCookies) {
    console.log("✅ Cookies.txt found");
} else {
    console.log("⚠️ Cookies.txt not found - using direct YouTube links");
}

// Caricamento metadati
let allVideos = [];
try {
    const metaData = fs.readFileSync(path.join(__dirname, "meta.json"), "utf-8");
    allVideos = JSON.parse(metaData);
    console.log(`✅ Loaded ${allVideos.length} videos from meta.json`);
    
} catch (error) {
    console.log("❌ No meta.json found, using empty array");
    allVideos = [];
}

// SOLO CANALE POCOYO - Tutti i video sono dello stesso canale
const metaDatabase = userConfig.channels
    .filter(channel => channel.enabled !== false)
    .map(channel => {
        // Prendi TUTTI i video perché sono tutti dello stesso canale
        return {
            ...channel,
            metas: allVideos // Tutti i video vanno allo stesso canale
        };
    });

console.log("📊 Channels summary:");
metaDatabase.forEach((channel, index) => {
    console.log(`   ${index}. ${channel.name}: ${channel.metas.length} videos`);
});

// Helper functions
function safeId(id) {
    return id ? encodeURIComponent(id.toString().trim()) : "unknown";
}

function processMetaDatabase(videos, channelIndex) {
    return videos.map((video, videoIndex) => ({
        id: `dakids-${channelIndex}-${safeId(video.id)}`,
        type: "movie",
        name: video.title || "Titolo Sconosciuto",
        poster: `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`,
        background: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
        description: `${video.title || "Video"} - ${video.viewCount || 0} visualizzazioni`,
        runtime: video.duration || "0:00",
        released: video.date ? video.date.split('T')[0] : "2025-01-01"
    }));
}

// Manifest - SOLO canale Pocoyo
app.get("/manifest.json", (req, res) => {
    res.json({
        id: "dakids-addon",
        version: "1.0.0",
        name: "📺 Dakids TV - Pocoyo",
        description: "Cartoni animati Pocoyo per bambini",
        resources: ["catalog", "stream"],
        types: ["movie"],
        catalogs: metaDatabase.map((channel, index) => ({
            type: "movie",
            id: `channel-${index}`,
            name: channel.name,
        })),
        idPrefixes: ["tt"],
        background: "https://i.ytimg.com/vi/6V0TR2BMN64/maxresdefault.jpg",
        logo: "https://i.ytimg.com/vi/6V0TR2BMN64/maxresdefault.jpg"
    });
});

// Cataloghi
app.get("/catalog/movie/channel-:index.json", (req, res) => {
    const index = parseInt(req.params.index);
    
    if (isNaN(index) || index < 0 || index >= metaDatabase.length) {
        return res.status(404).json({ error: "Channel not found" });
    }

    const channel = metaDatabase[index];
    const metas = processMetaDatabase(channel.metas, index);
    
    console.log(`📦 Returning ${metas.length} videos for channel ${index} (${channel.name})`);
    
    res.json({ metas });
});

// Stream
app.get("/stream/movie/:metaId.json", (req, res) => {
    const metaId = req.params.metaId;
    console.log(`🎬 Stream requested for: ${metaId}`);

    const match = metaId.match(/^dakids-(\d+)-(.+)$/);
    
    if (!match) {
        console.log("❌ Invalid meta ID format");
        return res.status(404).json({ error: "Invalid ID format" });
    }

    const channelIndex = parseInt(match[1]);
    const videoId = decodeURIComponent(match[2]);

    if (isNaN(channelIndex) || channelIndex < 0 || channelIndex >= metaDatabase.length) {
        console.log("❌ Channel not found");
        return res.status(404).json({ error: "Channel not found" });
    }

    const channel = metaDatabase[channelIndex];
    const video = channel.metas.find(v => v.id === videoId);
    
    if (!video) {
        console.log("❌ Video not found in channel");
        return res.status(404).json({ error: "Video not found" });
    }

    console.log(`✅ Found video: ${video.title}`);

    res.json({
        streams: [{
            title: "YouTube",
            url: `https://www.youtube.com/watch?v=${videoId}`
        }]
    });
});

// Health check
app.get("/health", (req, res) => {
    const totalVideos = metaDatabase.reduce((sum, channel) => sum + channel.metas.length, 0);
    
    res.json({ 
        status: "OK", 
        totalVideos: totalVideos,
        hasCookies: hasCookies,
        channels: metaDatabase.map(ch => ({
            name: ch.name,
            videoCount: ch.metas.length
        })),
        timestamp: new Date().toISOString()
    });
});

// HTML in tema bimbi per la homepage
app.get("/", (req, res) => {
    const totalVideos = metaDatabase.reduce((sum, channel) => sum + channel.metas.length, 0);
    const baseUrl = `https://${req.hostname}`;

    const html = `
    <!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🎨 Dakids TV - Pocoyo</title>
        <style>
            body {
                font-family: 'Comic Sans MS', cursive, sans-serif;
                background: linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%);
                margin: 0;
                padding: 20px;
                min-height: 100vh;
            }
            .container {
                max-width: 1000px;
                margin: 0 auto;
                background: white;
                border-radius: 20px;
                padding: 30px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                border: 5px solid #ff6b6b;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .title {
                color: #ff6b6b;
                font-size: 3em;
                margin: 0;
                text-shadow: 2px 2px 0 #ffe66d;
            }
            .status-badge {
                display: inline-block;
                padding: 8px 16px;
                background: #4ecdc4;
                color: white;
                border-radius: 20px;
                font-weight: bold;
                margin: 10px 0;
            }
            .channel-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
                margin: 30px 0;
            }
            .channel-card {
                background: linear-gradient(45deg, #ffe66d, #ff6b6b);
                padding: 20px;
                border-radius: 15px;
                color: white;
                text-align: center;
            }
            .channel-name {
                font-size: 1.3em;
                margin: 0 0 10px 0;
            }
            .channel-stats {
                font-size: 1.1em;
                margin: 5px 0;
            }
            .btn {
                display: inline-block;
                padding: 12px 24px;
                background: #4ecdc4;
                color: white;
                text-decoration: none;
                border-radius: 25px;
                margin: 10px;
                font-weight: bold;
            }
            .footer {
                text-align: center;
                margin-top: 40px;
                padding-top: 20px;
                border-top: 3px dotted #ffe66d;
                color: #666;
            }
            .animal {
                font-size: 2em;
                margin: 0 5px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 class="title">🎨 Dakids TV - Pocoyo</h1>
                <div class="status-badge">✅ Online e funzionante</div>
            </div>

            <div style="text-align: center; margin: 20px 0;">
                <span class="animal">🐘</span>
                <span class="animal">🦁</span>
                <span class="animal">🐰</span>
                <span class="animal">🐻</span>
            </div>

            <div class="channel-grid">
                ${metaDatabase.map((channel, index) => `
                    <div class="channel-card">
                        <h3 class="channel-name">${channel.name}</h3>
                        <div class="channel-stats">📺 ${channel.metas.length} video</div>
                        <a href="/catalog/movie/channel-${index}.json" class="btn" target="_blank">
                            Vedi Catalogo
                        </a>
                    </div>
                `).join('')}
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="/manifest.json" class="btn" target="_blank">📜 Manifest Stremio</a>
                <a href="/health" class="btn" target="_blank">❤️ Health Check</a>
            </div>

            <div style="text-align: center; margin: 20px 0;">
                <p>🎬 Video totali: <strong>${totalVideos}</strong></p>
                <p>📺 Canali: <strong>${metaDatabase.length}</strong></p>
                <p>🍪 Cookies: <strong>${hasCookies ? '✅ Presenti' : '⚠️ Link diretti'}</strong></p>
            </div>

            <div class="footer">
                <p>Per installare su Stremio, copia questo URL:</p>
                <code style="background: #ffe66d; padding: 10px; border-radius: 10px; display: block; margin: 10px auto; max-width: 400px;">
                    ${baseUrl}/manifest.json
                </code>
            </div>
        </div>
    </body>
    </html>`;

    res.send(html);
});

// Avvio server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🍪 Cookies: ${hasCookies ? '✅ Found' : '⚠️ Not found'}`);
    console.log(`📺 Total videos: ${metaDatabase.reduce((sum, channel) => sum + channel.metas.length, 0)}`);
    
    metaDatabase.forEach((channel, index) => {
        console.log(`   Channel ${index}: ${channel.name} - ${channel.metas.length} videos`);
    });
});
