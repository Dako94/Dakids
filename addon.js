#!/usr/bin/env node
import express from "express";
import axios from "axios";
import cors from "cors";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import youtubedl from "yt-dlp-exec";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 7000;

// Cartella per salvare i video scaricati
const VIDEO_DIR = path.join(__dirname, 'videos');
if (!fs.existsSync(VIDEO_DIR)) {
    fs.mkdirSync(VIDEO_DIR);
}

// Servi file statici (logo, background e video)
app.use('/media', express.static(path.join(__dirname, 'media')));
app.use('/videos', express.static(VIDEO_DIR));

// Leggi il file JSON
const metaData = JSON.parse(fs.readFileSync('./meta.json', 'utf-8'));

// Raggruppa i video per canale
function groupVideosByChannel(videos) {
    const channels = {};
    videos.forEach(video => {
        if (!channels[video.channelName]) {
            channels[video.channelName] = [];
        }
        channels[video.channelName].push(video);
    });
    return { channels };
}

const metaDatabase = groupVideosByChannel(metaData);

// Processa il database dei metadata
function processMetaDatabase() {
    const channels = [];
    for (const [channelName, videos] of Object.entries(metaDatabase.channels)) {
        if (videos && videos.length > 0) {
            channels.push({
                name: channelName,
                videos: videos.map(video => ({
                    id: video.id,
                    url: video.url,
                    title: video.title,
                    thumbnail: `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`,
                    description: `${video.title} - ${video.viewCount} visualizzazioni`,
                    duration: video.duration,
                    viewCount: video.viewCount,
                    likes: video.likes,
                    date: video.date
                }))
            });
        }
    }
    return channels;
}

// Inizializza i canali
let userConfig = {
    channels: processMetaDatabase()
};

// Funzione per ottenere lo stream MP4 (con yt-dlp)
async function getYouTubeStreamUrl(videoId) {
    try {
        const info = await youtubedl(`https://www.youtube.com/watch?v=${videoId}`, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: [
                'referer:youtube.com',
                'user-agent:googlebot'
            ]
        });

        // cerca il formato migliore (mp4 con audio + video)
        const format = info.formats.find(f => f.ext === 'mp4' && f.acodec !== 'none' && f.vcodec !== 'none');

        if (format && format.url) {
            console.log(`✅ Stream trovato per ${videoId}`);
            console.log(`👉 URL diretto: ${format.url}`);

            // Salva l'ultimo URL trovato in un file (debug)
            const debugPath = path.join(__dirname, "last_stream_url.txt");
            fs.writeFileSync(debugPath, format.url, "utf-8");
            console.log(`✍️ Salvato in ${debugPath}`);

            return format.url;
        }

        console.warn(`⚠️ Nessun formato valido per ${videoId}`);
        return `https://www.youtube.com/watch?v=${videoId}`;

    } catch (err) {
        console.error(`❌ Errore yt-dlp per ${videoId}: ${err.message}`);
        return `https://www.youtube.com/watch?v=${videoId}`;
    }
}


// Manifest
const manifest = {
    id: "com.dakids.Stremio",
    version: "2.0.0",
    name: "Dakids",
    description: "Video per bambini con metadata",
    logo: `http://localhost:${PORT}/media/icon.png`,
    background: `http://localhost:${PORT}/media/background.jpg`,
    resources: ["catalog", "stream"],
    types: ["movie"],
    idPrefixes: ["dakids-"],
    catalogs: userConfig.channels.map((channel, index) => ({
        type: "movie",
        id: `channel-${index}`,
        name: channel.name,
        poster: channel.videos[0]?.thumbnail,
        background: channel.videos[0]?.thumbnail,
        genres: ["Bambini", "Animazione", "Educativo"]
    }))
};

function updateManifest() {
    manifest.catalogs = userConfig.channels.map((channel, index) => ({
        type: 'movie',
        id: `channel_${index}`,
        name: channel.name,
        poster: channel.videos[0]?.thumbnail,
        background: channel.videos[0]?.thumbnail,
        genres: ['Bambini', 'Animazione', 'Educativo']
    }));
}

updateManifest();

// Routes
app.get('/manifest.json', (req, res) => {
    res.json(manifest);
});

app.get('/catalog/movie/channel_:index.json', (req, res) => {
    const index = parseInt(req.params.index);
    const channel = userConfig.channels[index];

    if (!channel) return res.json({ metas: [] });

    const metas = channel.videos.map((video, videoIndex) => ({
    id: `dakids-${index}-${video.id.replace(/^_/, '')}`,
    type: 'movie',
    name: video.title,
    poster: video.thumbnail,
    posterShape: 'landscape',
    background: video.thumbnail,
    description: video.description,
    genres: ['Bambini', channel.name],
    releaseInfo: video.date ? new Date(video.date).getFullYear().toString() : '2025',
    runtime: parseInt(video.duration.split(':')[1]) || 7,
    popularity: video.viewCount || (videoIndex + 1),
    isMovie: true
}));

    res.json({ metas });
});

app.get('/stream/movie/:metaId.json', async (req, res) => {
    const metaId = req.params.metaId; // esempio: dakids-0-6V0TR2BMN64

    const match = metaId.match(/^dakids-(\d+)-(.+)$/); // tutto dopo il secondo trattino è videoId
    if (!match) return res.json({ streams: [] });

    const channelIndex = parseInt(match[1]);
    const videoId = match[2]; // qui prendi TUTTO il videoId, senza tagli

    const channel = userConfig.channels[channelIndex];
    if (!channel) return res.json({ streams: [] });

    const video = channel.videos.find(v => v.id === videoId);
    if (!video) return res.json({ streams: [] });

    console.log("[STREAM REQUEST]", metaId, "=>", channelIndex, videoId);

    const streamUrl = await getYouTubeStreamUrl(videoId);

    res.json({
        streams: [{
            url: streamUrl,
            title: `YouTube - ${channel.name}`,
            name: 'HD'
        }]
    });
});




// API per ricaricare i video
app.post('/reload', (req, res) => {
    userConfig.channels = processMetaDatabase();
    updateManifest();
    res.json({
        success: true,
        message: 'Database ricaricato',
        channels: userConfig.channels.length,
        totalVideos: userConfig.channels.reduce((total, channel) => total + channel.videos.length, 0)
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        channels: userConfig.channels.length,
        totalVideos: userConfig.channels.reduce((total, channel) => total + channel.videos.length, 0),
        version: '1.0.0'
    });
});

// Dashboard
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Dakids - Addon con Metadata</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; max-width: 1200px; }
                .channel { margin: 30px 0; padding: 20px; border: 2px solid #ff6b6b; border-radius: 10px; }
                .video { margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 5px; }
                .video-info { margin: 5px 0; color: #666; font-size: 14px; }
                .stats { display: flex; gap: 15px; margin-top: 10px; }
                .stat { background: #e9ecef; padding: 5px 10px; border-radius: 3px; }
            </style>
        </head>
        <body>
            <h1>🎬 Dakids - Addon con Metadata Completi</h1>
            <p><strong>✅ Configurazione completata con metadata!</strong></p>
            <p>Aggiungi a Stremio: <code>http://localhost:${PORT}/manifest.json</code></p>

            <h2>📺 Canali Configurati:</h2>
            ${userConfig.channels.map((channel, index) => `
                <div class="channel">
                    <h3>${channel.name} (${channel.videos.length} video)</h3>
                    ${channel.videos.map(video => `
                        <div class="video">
                            <h4>${video.title}</h4>
                            <div class="video-info">
                                <strong>ID:</strong> ${video.id} |
                                <strong>Durata:</strong> ${video.duration} |
                                <strong>Data:</strong> ${new Date(video.date).toLocaleDateString()}
                            </div>
                            <div class="stats">
                                <span class="stat">👁️ ${video.viewCount} views</span>
                                <span class="stat">👍 ${video.likes} likes</span>
                                <span class="stat">📅 ${new Date(video.date).toLocaleDateString()}</span>
                            </div>
                            <img src="${video.thumbnail}" alt="${video.title}" style="max-width: 300px; margin-top: 10px; border-radius: 5px;">
                        </div>
                    `).join('')}
                </div>
            `).join('')}

            <p><strong>🔄 Per aggiornare:</strong> Modifica <code>meta.json</code> e visita <code>http://localhost:${PORT}/reload</code></p>
        </body>
        </html>
    `);
});

// Avvia il server
app.listen(PORT, () => {
    console.log('🎬 Dakids Addon con Metadata Avviato!');
    console.log('📺 Aggiungi a Stremio: http://localhost:' + PORT + '/manifest.json');
    console.log('🏠 Dashboard: http://localhost:' + PORT);
    console.log('🔄 Ricarica: http://localhost:' + PORT + '/reload');
    console.log('\n📋 Canali e video caricati:');
    userConfig.channels.forEach((channel, index) => {
        console.log(`\n   ${index + 1}. ${channel.name}`);
        channel.videos.forEach((video, videoIndex) => {
            console.log(`      📹 ${videoIndex + 1}. ${video.title}`);
            console.log(`          👁️ ${video.viewCount} views | 👍 ${video.likes} | 📅 ${new Date(video.date).toLocaleDateString()}`);
        });
    });
});
