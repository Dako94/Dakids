#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import pkg from "yt-dlp-wrap";   // Importa come CommonJS default
import { fileURLToPath } from "url";
import { dirname } from "path";

const { YtDlpWrap } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;

// Cartella per salvare i video scaricati (opzionale)
const VIDEO_DIR = path.join(__dirname, 'videos');
if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR);

// Cartella media per file statici
const MEDIA_DIR = path.join(__dirname, 'media');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR);

// Servi file statici (logo, background e video)
app.use('/media', express.static(MEDIA_DIR));
app.use('/videos', express.static(VIDEO_DIR));

// Crea file placeholder se non esistono
const createPlaceholderFiles = () => {
    const iconPath = path.join(MEDIA_DIR, 'icon.png');
    const backgroundPath = path.join(MEDIA_DIR, 'background.jpg');
    
    if (!fs.existsSync(iconPath)) {
        fs.writeFileSync(iconPath, '');
    }
    if (!fs.existsSync(backgroundPath)) {
        fs.writeFileSync(backgroundPath, '');
    }
};
createPlaceholderFiles();

// Helper per ID sicuri
function safeId(id) {
    if (!id) return "unknown";
    return encodeURIComponent(id.toString().trim());
}

// Leggi il file JSON con i metadata (con fallback)
let metaData = [];
const metaPath = path.join(__dirname, 'meta.json');

if (fs.existsSync(metaPath)) {
    try {
        metaData = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    } catch (err) {
        console.error('⚠️ Errore nel leggere meta.json:', err.message);
        metaData = [
            {
                id: "dQw4w9WgXcQ",
                url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                title: "Video di Test",
                channelName: "Canale Test",
                duration: "3:32",
                viewCount: 1000,
                likes: 100,
                date: "2025-01-01"
            }
        ];
    }
} else {
    console.warn('⚠️ File meta.json non trovato, creo dati di esempio');
    metaData = [
        {
            id: "dQw4w9WgXcQ",
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            title: "Video di Test",
            channelName: "Canale Test",
            duration: "3:32",
            viewCount: 1000,
            likes: 100,
            date: "2025-01-01"
        }
    ];
    fs.writeFileSync(metaPath, JSON.stringify(metaData, null, 2));
}

// Raggruppa i video per canale
function groupVideosByChannel(videos) {
    const channels = {};
    videos.forEach(video => {
        const channelName = video.channelName || 'Canale Sconosciuto';
        if (!channels[channelName]) channels[channelName] = [];
        channels[channelName].push(video);
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
                    id: safeId(video.id),
                    url: video.url || `https://www.youtube.com/watch?v=${video.id}`,
                    title: video.title || 'Titolo Sconosciuto',
                    thumbnail: `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`,
                    description: `${video.title || 'Video'} - ${video.viewCount || 0} visualizzazioni`,
                    duration: video.duration || '0:00',
                    viewCount: video.viewCount || 0,
                    likes: video.likes || 0,
                    date: video.date || '2025-01-01'
                }))
            });
        }
    }
    return channels;
}

// Config globale dei canali
let userConfig = { channels: processMetaDatabase() };

// Inizializza yt-dlp-wrap
let ytdlp;
try {
    ytdlp = new YtDlpWrap();
} catch (err) {
    console.error('⚠️ Errore nell\'inizializzare yt-dlp-wrap:', err.message);
}

// Funzione per ottenere lo stream diretto da YouTube
async function getYouTubeStreamUrl(videoId) {
    if (!ytdlp) {
        console.error('❌ yt-dlp non disponibile');
        return `https://www.youtube.com/watch?v=${videoId}`;
    }

    try {
        let cookiesFile = './cookies.txt';
        if (process.env.YOUTUBE_COOKIES_PATH) {
            cookiesFile = process.env.YOUTUBE_COOKIES_PATH;
        }

        const args = [
            '-j',
            '--no-warnings',
            '--no-check-certificate',
            '--prefer-free-formats'
        ];

        if (fs.existsSync(cookiesFile)) {
            args.push(`--cookies=${cookiesFile}`);
        }

        const infoRaw = await ytdlp.execPromise(`https://www.youtube.com/watch?v=${videoId}`, args);
        const info = JSON.parse(infoRaw);

        const format = info.formats.find(f => 
            f.ext === 'mp4' && f.acodec !== 'none' && f.vcodec !== 'none'
        );
        
        if (format && format.url) {
            console.log(`✅ Stream trovato per ${videoId}`);
            try {
                fs.writeFileSync(path.join(__dirname, "last_stream_url.txt"), format.url, "utf-8");
            } catch (writeErr) {
                console.warn('⚠️ Impossibile scrivere last_stream_url.txt');
            }
            return format.url;
        }

        console.warn(`⚠️ Nessun formato valido per ${videoId}`);
        return `https://www.youtube.com/watch?v=${videoId}`;
    } catch (err) {
        console.error(`❌ Errore yt-dlp per ${videoId}: ${err.message}`);
        return `https://www.youtube.com/watch?v=${videoId}`;
    }
}

// Ottieni l'URL base dinamico
function getBaseUrl(req) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers.host;
    return `${protocol}://${host}`;
}

// Manifest Stremio
function getManifest(req) {
    const baseUrl = getBaseUrl(req);
    
    return {
        id: "com.dakids.stremio",
        version: "2.0.0",
        name: "Dakids",
        description: "Video per bambini - Addon pronto all'uso con metadata completi",
        logo: `${baseUrl}/media/icon.png`,
        background: `${baseUrl}/media/background.jpg`,
        resources: ["catalog", "stream"],
        types: ["movie"],
        idPrefixes: ["dakids-"],
        catalogs: userConfig.channels.map((channel, index) => ({
            type: "movie",
            id: `channel-${index}`,
            name: channel.name,
            extra: []
        }))
    };
}

// ROUTE: manifest.json
app.get('/manifest.json', (req, res) => {
    res.json(getManifest(req));
});

// ROUTE: catalogo
app.get('/catalog/movie/channel-:index.json', (req, res) => {
    const index = parseInt(req.params.index);
    const channel = userConfig.channels[index];
    
    if (!channel) {
        return res.json({ metas: [] });
    }

    const metas = channel.videos.map((video, videoIndex) => ({
        id: `dakids-${index}-${video.id}`,
        type: "movie",
        name: video.title,
        poster: video.thumbnail,
        posterShape: "landscape",
        background: video.thumbnail,
        description: video.description,
        genres: ["Bambini", channel.name],
        releaseInfo: video.date ? new Date(video.date).getFullYear().toString() : "2025",
        runtime: video.duration ? Math.max(parseInt(video.duration.split(':')[0]) * 60 + parseInt(video.duration.split(':')[1] || 0), 1) : 7,
        imdbRating: Math.min(8.5 + (video.likes / 10000), 9.9).toFixed(1)
    }));

    res.json({ metas });
});

// ROUTE: stream
app.get('/stream/movie/:metaId.json', async (req, res) => {
    const metaId = req.params.metaId;
    const match = metaId.match(/^dakids-(\d+)-(.+)$/);
    
    if (!match) {
        return res.json({ streams: [] });
    }

    const channelIndex = parseInt(match[1]);
    const videoId = decodeURIComponent(match[2]);   // decode ID sicuro
    const channel = userConfig.channels[channelIndex];
    
    if (!channel) {
        return res.json({ streams: [] });
    }

    const video = channel.videos.find(v => v.id === safeId(videoId));
    if (!video) {
        return res.json({ streams: [] });
    }

    console.log(`[STREAM REQUEST] ${metaId} => Channel: ${channelIndex}, Video: ${videoId}`);

    const streamUrl = await getYouTubeStreamUrl(videoId);

    res.json({
        streams: [{
            url: streamUrl,
            title: `YouTube - ${channel.name}`,
            name: "HD",
            behaviorHints: {
                notWebReady: true
            }
        }]
    });
});

// ROUTE: reload database
app.post('/reload', (req, res) => {
    try {
        if (fs.existsSync(metaPath)) {
            metaData = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            const newMetaDatabase = groupVideosByChannel(metaData);
            userConfig.channels = processMetaDatabase();
            
            res.json({
                success: true,
                message: "Database ricaricato con successo",
                channels: userConfig.channels.length,
                totalVideos: userConfig.channels.reduce((total, ch) => total + ch.videos.length, 0)
            });
        } else {
            res.status(404).json({
                success: false,
                message: "File meta.json non trovato"
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: `Errore nel ricaricare il database: ${err.message}`
        });
    }
});

// ROUTE: health check
app.get('/health', (req, res) => {
    res.json({
        status: "OK",
        channels: userConfig.channels.length,
        totalVideos: userConfig.channels.reduce((total, ch) => total + ch.videos.length, 0),
        version: "2.0.0",
        ytdlpAvailable: !!ytdlp
    });
});

// ROUTE: info sui canali
app.get('/channels', (req, res) => {
    res.json({
        channels: userConfig.channels.map((channel, index) => ({
            index,
            name: channel.name,
            videoCount: channel.videos.length,
            catalogUrl: `/catalog/movie/channel-${index}.json`
        }))
    });
});

// ROUTE: Dashboard web migliorata
app.get('/', (req, res) => {
    const baseUrl = getBaseUrl(req);
    const channelsList = userConfig.channels.map((channel, index) => 
        `<li><strong>${channel.name}</strong> (${channel.videos.length} video) - 
         <a href="/catalog/movie/channel-${index}.json">Catalogo</a></li>`
    ).join('');
    
    res.send(`
    <html>
    <head>
        <title>Dakids Addon</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .container { max-width: 800px; margin: 0 auto; }
            .status { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .links a { margin-right: 15px; padding: 8px 12px; background: #007bff; color: white; text-decoration: none; border-radius: 3px; }
            .links a:hover { background: #0056b3; }
            ul { line-height: 1.6; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎬 Dakids Addon</h1>
            
            <div class="status">
                <strong>Status:</strong> Online ✅<br>
                <strong>Canali:</strong> ${userConfig.channels.length}<br>
                <strong>Video totali:</strong> ${userConfig.channels.reduce((total, ch) => total + ch.videos.length, 0)}<br>
                <strong>yt-dlp:</strong> ${ytdlp ? 'Disponibile' : 'Non disponibile'}
            </div>
            
            <div class="links">
                <a href="/manifest.json">📋 Manifest</a>
                <a href="/health">❤️ Health Check</a>
                <a href="/channels">📺 Canali</a>
            </div>
            
            <h3>Canali Disponibili:</h3>
            <ul>${channelsList}</ul>
            
            <p><small>Per usare questo addon in Stremio, copia questo URL: <code>${baseUrl}/manifest.json</code></small></p>
        </div>
    </body>
    </html>`);
});

// Middleware per gestire errori 404
app.use((req, res) => {
    res.status(404).json({
        error: "Endpoint non trovato",
        path: req.path,
        availableEndpoints: [
            "/manifest.json",
            "/catalog/movie/channel-{index}.json",
            "/stream/movie/{metaId}.json",
            "/health",
            "/channels",
            "/reload (POST)"
        ]
    });
});

// Middleware per gestire errori generali
app.use((err, req, res, next) => {
    console.error('Errore del server:', err);
    res.status(500).json({
        error: "Errore interno del server",
        message: err.message
    });
});

// Avvio server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎬 Dakids Addon avviato su http://0.0.0.0:${PORT}`);
    console.log(`📋 Manifest disponibile su: http://0.0.0.0:${PORT}/manifest.json`);
    console.log(`📊 Dashboard: http://0.0.0.0:${PORT}/`);
    console.log(`📺 Canali configurati: ${userConfig.channels.length}`);
});        if (!channels[channelName]) channels[channelName] = [];
        channels[channelName].push(video);
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
                    id: video.id ? video.id.replace(/^_/, '') : 'unknown',
                    url: video.url || `https://www.youtube.com/watch?v=${video.id}`,
                    title: video.title || 'Titolo Sconosciuto',
                    thumbnail: `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`,
                    description: `${video.title || 'Video'} - ${video.viewCount || 0} visualizzazioni`,
                    duration: video.duration || '0:00',
                    viewCount: video.viewCount || 0,
                    likes: video.likes || 0,
                    date: video.date || '2025-01-01'
                }))
            });
        }
    }
    return channels;
}

// Config globale dei canali
let userConfig = { channels: processMetaDatabase() };

// Inizializza yt-dlp-wrap
let ytdlp;
try {
    ytdlp = new YtDlpWrap();
} catch (err) {
    console.error('⚠️ Errore nell\'inizializzare yt-dlp-wrap:', err.message);
}

// Funzione per ottenere lo stream diretto da YouTube
async function getYouTubeStreamUrl(videoId) {
    if (!ytdlp) {
        console.error('❌ yt-dlp non disponibile');
        return `https://www.youtube.com/watch?v=${videoId}`;
    }

    try {
        let cookiesFile = './cookies.txt';
        if (process.env.YOUTUBE_COOKIES_PATH) {
            cookiesFile = process.env.YOUTUBE_COOKIES_PATH;
        }

        const args = [
            '-j', // JSON output
            '--no-warnings',
            '--no-check-certificate',
            '--prefer-free-formats'
        ];

        if (fs.existsSync(cookiesFile)) {
            args.push(`--cookies=${cookiesFile}`);
        }

        const infoRaw = await ytdlp.execPromise(`https://www.youtube.com/watch?v=${videoId}`, args);
        const info = JSON.parse(infoRaw);

        const format = info.formats.find(f => 
            f.ext === 'mp4' && f.acodec !== 'none' && f.vcodec !== 'none'
        );
        
        if (format && format.url) {
            console.log(`✅ Stream trovato per ${videoId}`);
            try {
                fs.writeFileSync(path.join(__dirname, "last_stream_url.txt"), format.url, "utf-8");
            } catch (writeErr) {
                console.warn('⚠️ Impossibile scrivere last_stream_url.txt');
            }
            return format.url;
        }

        console.warn(`⚠️ Nessun formato valido per ${videoId}`);
        return `https://www.youtube.com/watch?v=${videoId}`;
    } catch (err) {
        console.error(`❌ Errore yt-dlp per ${videoId}: ${err.message}`);
        return `https://www.youtube.com/watch?v=${videoId}`;
    }
}

// Ottieni l'URL base dinamico
function getBaseUrl(req) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers.host;
    return `${protocol}://${host}`;
}

// Manifest Stremio
function getManifest(req) {
    const baseUrl = getBaseUrl(req);
    
    return {
        id: "com.dakids.stremio",
        version: "2.0.0",
        name: "Dakids",
        description: "Video per bambini - Addon pronto all'uso con metadata completi",
        logo: `${baseUrl}/media/icon.png`,
        background: `${baseUrl}/media/background.jpg`,
        resources: ["catalog", "stream"],
        types: ["movie"],
        idPrefixes: ["dakids-"],
        catalogs: userConfig.channels.map((channel, index) => ({
            type: "movie",
            id: `channel-${index}`,
            name: channel.name,
            extra: []
        }))
    };
}

// ROUTE: manifest.json
app.get('/manifest.json', (req, res) => {
    res.json(getManifest(req));
});

// ROUTE: catalogo - FIX: usa il formato corretto
app.get('/catalog/movie/channel-:index.json', (req, res) => {
    const index = parseInt(req.params.index);
    const channel = userConfig.channels[index];
    
    if (!channel) {
        return res.json({ metas: [] });
    }

    const metas = channel.videos.map((video, videoIndex) => ({
        id: `dakids-${index}-${video.id}`,
        type: "movie",
        name: video.title,
        poster: video.thumbnail,
        posterShape: "landscape",
        background: video.thumbnail,
        description: video.description,
        genres: ["Bambini", channel.name],
        releaseInfo: video.date ? new Date(video.date).getFullYear().toString() : "2025",
        runtime: video.duration ? Math.max(parseInt(video.duration.split(':')[0]) * 60 + parseInt(video.duration.split(':')[1] || 0), 1) : 7,
        imdbRating: Math.min(8.5 + (video.likes / 10000), 9.9).toFixed(1)
    }));

    res.json({ metas });
});

// ROUTE: stream
app.get('/stream/movie/:metaId.json', async (req, res) => {
    const metaId = req.params.metaId;
    const match = metaId.match(/^dakids-(\d+)-(.+)$/);
    
    if (!match) {
        return res.json({ streams: [] });
    }

    const channelIndex = parseInt(match[1]);
    const videoId = match[2];
    const channel = userConfig.channels[channelIndex];
    
    if (!channel) {
        return res.json({ streams: [] });
    }

    const video = channel.videos.find(v => v.id === videoId);
    if (!video) {
        return res.json({ streams: [] });
    }

    console.log(`[STREAM REQUEST] ${metaId} => Channel: ${channelIndex}, Video: ${videoId}`);

    const streamUrl = await getYouTubeStreamUrl(videoId);

    res.json({
        streams: [{
            url: streamUrl,
            title: `YouTube - ${channel.name}`,
            name: "HD",
            behaviorHints: {
                notWebReady: true
            }
        }]
    });
});

// ROUTE: reload database
app.post('/reload', (req, res) => {
    try {
        // Rileggi il file meta.json
        if (fs.existsSync(metaPath)) {
            metaData = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            const newMetaDatabase = groupVideosByChannel(metaData);
            userConfig.channels = processMetaDatabase();
            
            res.json({
                success: true,
                message: "Database ricaricato con successo",
                channels: userConfig.channels.length,
                totalVideos: userConfig.channels.reduce((total, ch) => total + ch.videos.length, 0)
            });
        } else {
            res.status(404).json({
                success: false,
                message: "File meta.json non trovato"
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: `Errore nel ricaricare il database: ${err.message}`
        });
    }
});

// ROUTE: health check
app.get('/health', (req, res) => {
    res.json({
        status: "OK",
        channels: userConfig.channels.length,
        totalVideos: userConfig.channels.reduce((total, ch) => total + ch.videos.length, 0),
        version: "2.0.0",
        ytdlpAvailable: !!ytdlp
    });
});

// ROUTE: info sui canali
app.get('/channels', (req, res) => {
    res.json({
        channels: userConfig.channels.map((channel, index) => ({
            index,
            name: channel.name,
            videoCount: channel.videos.length,
            catalogUrl: `/catalog/movie/channel-${index}.json`
        }))
    });
});

// ROUTE: Dashboard web migliorata
app.get('/', (req, res) => {
    const baseUrl = getBaseUrl(req);
    const channelsList = userConfig.channels.map((channel, index) => 
        `<li><strong>${channel.name}</strong> (${channel.videos.length} video) - 
         <a href="/catalog/movie/channel-${index}.json">Catalogo</a></li>`
    ).join('');
    
    res.send(`
    <html>
    <head>
        <title>Dakids Addon</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .container { max-width: 800px; margin: 0 auto; }
            .status { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .links a { margin-right: 15px; padding: 8px 12px; background: #007bff; color: white; text-decoration: none; border-radius: 3px; }
            .links a:hover { background: #0056b3; }
            ul { line-height: 1.6; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎬 Dakids Addon</h1>
            
            <div class="status">
                <strong>Status:</strong> Online ✅<br>
                <strong>Canali:</strong> ${userConfig.channels.length}<br>
                <strong>Video totali:</strong> ${userConfig.channels.reduce((total, ch) => total + ch.videos.length, 0)}<br>
                <strong>yt-dlp:</strong> ${ytdlp ? 'Disponibile' : 'Non disponibile'}
            </div>
            
            <div class="links">
                <a href="/manifest.json">📋 Manifest</a>
                <a href="/health">❤️ Health Check</a>
                <a href="/channels">📺 Canali</a>
            </div>
            
            <h3>Canali Disponibili:</h3>
            <ul>${channelsList}</ul>
            
            <p><small>Per usare questo addon in Stremio, copia questo URL: <code>${baseUrl}/manifest.json</code></small></p>
        </div>
    </body>
    </html>`);
});

// Middleware per gestire errori 404
app.use((req, res) => {
    res.status(404).json({
        error: "Endpoint non trovato",
        path: req.path,
        availableEndpoints: [
            "/manifest.json",
            "/catalog/movie/channel-{index}.json",
            "/stream/movie/{metaId}.json",
            "/health",
            "/channels",
            "/reload (POST)"
        ]
    });
});

// Middleware per gestire errori generali
app.use((err, req, res, next) => {
    console.error('Errore del server:', err);
    res.status(500).json({
        error: "Errore interno del server",
        message: err.message
    });
});

// Avvio server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎬 Dakids Addon avviato su http://0.0.0.0:${PORT}`);
    console.log(`📋 Manifest disponibile su: http://0.0.0.0:${PORT}/manifest.json`);
    console.log(`📊 Dashboard: http://0.0.0.0:${PORT}/`);
    console.log(`📺 Canali configurati: ${userConfig.channels.length}`);
});
