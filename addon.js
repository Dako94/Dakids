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

// Middleware per logging
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.url}`);
    next();
});

// ------------------ CONFIG CANALI ------------------
const userConfig = {
    channels: [
        {
            name: "Pocoyo 🇮🇹 Italiano - Canale Ufficiale",
            id: "UCwQ-5RSINDVfzfxyTtQPSww",
            enabled: true
        }
    ]
};

// ------------------ CARICAMENTO META.JSON ------------------
const metaPath = path.join(__dirname, "meta.json");
let allVideos = [];
try {
    const metaData = fs.readFileSync(metaPath, "utf-8");
    allVideos = JSON.parse(metaData);
    console.log(`✅ Loaded ${allVideos.length} videos from meta.json`);
    
    // Filtra solo video con ID YouTube validi
    allVideos = allVideos.filter(video => {
        if (!video.id || typeof video.id !== 'string' || video.id.length < 10) {
            console.warn(`⚠️ Skipping invalid video ID: ${video.id} - ${video.title}`);
            return false;
        }
        return true;
    });
    console.log(`✅ After filtering: ${allVideos.length} valid videos`);
    
} catch (error) {
    console.log("❌ Error loading meta.json:", error.message);
    allVideos = [];
}

// ------------------ CREAZIONE DATABASE DEI CANALI ------------------
const metaDatabase = userConfig.channels
    .filter(channel => channel.enabled !== false)
    .map(channel => ({
        ...channel,
        metas: allVideos
    }));

console.log("📊 Channels summary:");
metaDatabase.forEach((channel, index) => {
    console.log(`   ${index}. ${channel.name}: ${channel.metas.length} video(s)`);
});

// ------------------ HELPERS ------------------
function createStremioId(videoId, channelIndex) {
    // Crea un ID compatibile con Stremio (deve iniziare con tt per essere riconosciuto come film)
    return `tt${channelIndex}${videoId}`;
}

function processMetaDatabase(videos, channelIndex) {
    console.log(`🔄 Processing ${videos.length} videos for channel ${channelIndex}`);
    
    const processedVideos = videos.map((video, index) => {
        try {
            const stremioId = createStremioId(video.id, channelIndex);
            const meta = {
                id: stremioId,
                type: "movie",
                name: video.title || "Titolo Sconosciuto",
                poster: `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`,
                background: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
                description: `${video.title || "Video"}\n\n👀 ${video.viewCount || 0} visualizzazioni\n⏱️ Durata: ${video.duration || "N/A"}\n📅 ${video.date ? new Date(video.date).toLocaleDateString('it-IT') : 'Data sconosciuta'}`,
                runtime: video.duration || "N/A",
                released: video.date ? video.date.split('T')[0] : "2024-01-01",
                genres: ["Animation", "Family", "Kids"],
                imdbRating: "7.5",
                // Aggiungi metadati extra per Stremio
                year: video.date ? new Date(video.date).getFullYear() : 2024,
                moviedb_id: index + 1000, // ID fittizio ma necessario
                // Salva l'ID YouTube originale nei metadati
                youtubeId: video.id
            };
            
            console.log(`✅ Processed: ${meta.name} (ID: ${meta.id})`);
            return meta;
        } catch (error) {
            console.error(`❌ Error processing video:`, video, error);
            return null;
        }
    }).filter(Boolean);
    
    console.log(`✅ Successfully processed ${processedVideos.length} videos`);
    return processedVideos;
}

// ------------------ ROUTE MANIFEST ------------------
app.get("/manifest.json", (req, res) => {
    try {
        const manifest = {
            id: "dakids.addon",
            version: "1.0.0",
            name: "📺 Dakids TV",
            description: "Cartoni animati per bambini - Pocoyo, Peppa Pig e molto altro!",
            resources: ["catalog", "stream"],
            types: ["movie"],
            catalogs: metaDatabase.map((channel, index) => ({
                type: "movie",
                id: `dakids_channel_${index}`,
                name: channel.name,
                extra: [
                    {
                        name: "skip",
                        isRequired: false
                    }
                ]
            })),
            idPrefixes: ["tt"], // Manteniamo tt perché i nostri ID iniziano con tt
            background: "https://i.ytimg.com/vi/6V0TR2BMN64/maxresdefault.jpg",
            logo: "https://i.ytimg.com/vi/6V0TR2BMN64/maxresdefault.jpg"
        };
        
        console.log(`📜 Serving manifest with ${manifest.catalogs.length} catalogs`);
        res.json(manifest);
    } catch (error) {
        console.error("❌ Error in manifest:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ------------------ ROUTE CATALOG ------------------
app.get("/catalog/movie/dakids_channel_:index.json", (req, res) => {
    try {
        const index = parseInt(req.params.index);
        console.log(`📦 Catalog request for channel ${index}`);
        
        if (isNaN(index) || index < 0 || index >= metaDatabase.length) {
            console.warn(`⚠️ Invalid channel index: ${req.params.index}`);
            return res.status(404).json({ error: "Channel not found" });
        }
        
        const channel = metaDatabase[index];
        console.log(`📺 Channel "${channel.name}" has ${channel.metas.length} raw videos`);
        
        const metas = processMetaDatabase(channel.metas, index);
        console.log(`📦 Returning ${metas.length} processed videos for channel ${index}`);
        
        // Aggiungi logging dettagliato per il primo video
        if (metas.length > 0) {
            console.log(`📋 First video sample:`, JSON.stringify(metas[0], null, 2));
        }
        
        res.json({ metas });
    } catch (error) {
        console.error("❌ Error in catalog:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ------------------ ROUTE STREAM ------------------
app.get("/stream/movie/:metaId.json", (req, res) => {
    try {
        const metaId = req.params.metaId;
        console.log(`🎬 Stream request for: ${metaId}`);
        
        // Estrai channelIndex e videoId dall'ID Stremio
        const match = metaId.match(/^tt(\d+)(.+)$/);
        if (!match) {
            console.warn(`⚠️ Invalid ID format: ${metaId}`);
            return res.status(404).json({ error: "Invalid ID format" });
        }

        const channelIndex = parseInt(match[1]);
        const youtubeId = match[2];

        console.log(`🔍 Looking for channel ${channelIndex}, video ${youtubeId}`);

        if (isNaN(channelIndex) || channelIndex < 0 || channelIndex >= metaDatabase.length) {
            console.warn(`⚠️ Invalid channel: ${channelIndex}`);
            return res.status(404).json({ error: "Channel not found" });
        }

        const channel = metaDatabase[channelIndex];
        const video = channel.metas.find(v => v.id === youtubeId);
        
        if (!video) {
            console.warn(`⚠️ Video not found: ${youtubeId} in channel ${channelIndex}`);
            console.log(`Available videos:`, channel.metas.map(v => v.id));
            return res.status(404).json({ error: "Video not found" });
        }

        console.log(`✅ Serving stream for: ${video.title}`);
        res.json({
            streams: [{
                title: `🎬 ${video.title}`,
                url: `https://www.youtube.com/watch?v=${youtubeId}`,
                ytId: youtubeId,
                behaviorHints: {
                    bingeGroup: `dakids-${channelIndex}`,
                    countryWhitelist: ["IT"]
                }
            }]
        });
    } catch (error) {
        console.error("❌ Error in stream:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ------------------ HEALTH CHECK ------------------
app.get("/health", (req, res) => {
    try {
        const totalVideos = metaDatabase.reduce((sum, channel) => sum + channel.metas.length, 0);
        res.json({
            status: "OK",
            totalVideos: totalVideos,
            channels: metaDatabase.map(ch => ({
                name: ch.name,
                videoCount: ch.metas.length
            })),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("❌ Error in health:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ------------------ TEST CATALOG (per debug) ------------------
app.get("/test-catalog", (req, res) => {
    try {
        const channel = metaDatabase[0];
        if (!channel) {
            return res.json({ error: "No channel found" });
        }
        
        const metas = processMetaDatabase(channel.metas, 0);
        res.json({
            channelName: channel.name,
            totalVideos: channel.metas.length,
            processedVideos: metas.length,
            sampleVideo: metas[0] || null,
            allVideoIds: metas.map(m => ({
                stremioId: m.id,
                youtubeId: m.originalYouTubeId
            }))
        });
    } catch (error) {
        console.error("❌ Error in test-catalog:", error);
        res.status(500).json({ error: error.message });
    }
});

// ------------------ HOMEPAGE HTML ------------------
app.get("/", (req, res) => {
    try {
        const totalVideos = metaDatabase.reduce((sum, channel) => sum + channel.metas.length, 0);
        const baseUrl = `https://${req.get('host') || req.hostname}`;
        const html = `
        <!DOCTYPE html>
        <html lang="it">
        <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🎨 Dakids TV</title>
        <style>
        body { font-family:'Comic Sans MS',cursive,sans-serif; background: linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%); margin:0;padding:20px;min-height:100vh; }
        .container { max-width:1000px;margin:0 auto;background:white;border-radius:20px;padding:30px;box-shadow:0 10px 30px rgba(0,0,0,0.1);border:5px solid #ff6b6b; }
        .header { text-align:center;margin-bottom:30px; }
        .title { color:#ff6b6b;font-size:3em;margin:0;text-shadow:2px 2px 0 #ffe66d; }
        .status-badge { display:inline-block;padding:8px 16px;background:#4ecdc4;color:white;border-radius:20px;font-weight:bold;margin:10px 0; }
        .channel-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:20px; margin:30px 0; }
        .channel-card { background:linear-gradient(45deg, #ffe66d, #ff6b6b); padding:20px; border-radius:15px; color:white; text-align:center; }
        .channel-name { font-size:1.3em; margin:0 0 10px 0; }
        .channel-stats { font-size:1.1em; margin:5px 0; }
        .btn { display:inline-block;padding:12px 24px; background:#4ecdc4;color:white;text-decoration:none;border-radius:25px;margin:10px;font-weight:bold; }
        .footer { text-align:center;margin-top:40px;padding-top:20px;border-top:3px dotted #ffe66d;color:#666; }
        .animal { font-size:2em; margin:0 5px; }
        .debug { background:#f0f0f0; padding:15px; border-radius:10px; margin:20px 0; text-align:left; }
        </style>
        </head>
        <body>
        <div class="container">
            <div class="header">
                <h1 class="title">🎨 Dakids TV</h1>
                <div class="status-badge">✅ Online e funzionante</div>
            </div>
            
            <div class="channel-grid">
                ${metaDatabase.map((channel,index)=>`
                <div class="channel-card">
                    <h3 class="channel-name">${channel.name}</h3>
                    <div class="channel-stats">📺 ${channel.metas.length} video</div>
                    <a href="/catalog/movie/dakids_channel_${index}.json" class="btn" target="_blank">Vedi Catalogo</a>
                </div>
                `).join('')}
            </div>
            
            <div style="text-align:center;margin:30px 0;">
                <a href="/manifest.json" class="btn" target="_blank">📜 Manifest Stremio</a>
                <a href="/health" class="btn" target="_blank">❤️ Health Check</a>
                <a href="/test-catalog" class="btn" target="_blank">🧪 Test Catalog</a>
            </div>
            
            <div style="text-align:center;margin:20px 0;">
                <p>🎬 Video totali: <strong>${totalVideos}</strong></p>
                <p>📺 Canali: <strong>${metaDatabase.length}</strong></p>
            </div>
            
            <div class="debug">
                <h3>🔧 Debug Info:</h3>
                <p><strong>Manifest URL:</strong> <code>${baseUrl}/manifest.json</code></p>
                <p><strong>Catalog URL:</strong> <code>${baseUrl}/catalog/movie/dakids_channel_0.json</code></p>
                <p><strong>Test URL:</strong> <code>${baseUrl}/test-catalog</code></p>
            </div>
            
            <div class="footer">
                <p>Per installare su Stremio, copia questo URL:</p>
                <code style="background:#ffe66d;padding:10px;border-radius:10px;display:block;margin:10px auto;max-width:600px;word-break:break-all;">
                    ${baseUrl}/manifest.json
                </code>
            </div>
        </div>
        </body>
        </html>
        `;
        res.send(html);
    } catch (error) {
        console.error("❌ Error in homepage:", error);
        res.status(500).send("Internal server error");
    }
});

// Gestione errori globale
app.use((error, req, res, next) => {
    console.error('❌ Unhandled error:', error);
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Gestione 404
app.use('*', (req, res) => {
    console.log(`❌ 404 - Not Found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
        error: "Not Found", 
        path: req.originalUrl 
    });
});

// ------------------ AVVIO SERVER ------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📺 Total videos: ${metaDatabase.reduce((sum, ch) => sum + ch.metas.length, 0)}`);
    console.log(`🌐 Access at: http://localhost:${PORT}`);
    console.log(`📜 Manifest: http://localhost:${PORT}/manifest.json`);
    console.log(`🧪 Test: http://localhost:${PORT}/test-catalog`);
});
