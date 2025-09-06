import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// === CONFIGURAZIONE ===
const PLAYLIST_URL = process.argv[2]; // es: node scraper-playlist.js <playlist_url> <channel_name>
const CHANNEL_NAME = process.argv[3]; // es: Bluey

if (!PLAYLIST_URL || !CHANNEL_NAME) {
  console.error("❌ Usa: node scraper-playlist.js <playlist_url> <channel>");
  process.exit(1);
}

// === Percorso yt-dlp.exe (modifica se lo hai in un'altra cartella) ===
const YTDLP_PATH = `"C:\\Program Files\\yt-dlp\\yt-dlp.exe"`;
// oppure: const YTDLP_PATH = `"C:\\yt-dlp\\yt-dlp.exe"`

const OUTPUT_DIR = path.resolve("./videos");
const META_PATH = path.resolve("./meta.json");

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

console.log(`📥 Scarico tutti i video da: ${PLAYLIST_URL}`);
console.log(`📁 Salvo in canale: ${CHANNEL_NAME}`);

try {
  // Scarica video e metadati
  execSync(`${YTDLP_PATH} -f mp4 -o "${OUTPUT_DIR}/%(id)s.mp4" --write-info-json "${PLAYLIST_URL}"`, {
    stdio: "inherit"
  });

  // Leggi tutti i file info.json generati
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith(".info.json"));
  const newMetas = files.map(file => {
    const data = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, file), "utf-8"));
    return {
      youtubeId: data.id,
      title: data.title,
      poster: `https://i.ytimg.com/vi/${data.id}/hqdefault.jpg`,
      channel: CHANNEL_NAME
    };
  });

  // Unisci con meta.json esistente
  let existing = [];
  if (fs.existsSync(META_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(META_PATH, "utf-8"));
    } catch {
      console.warn("⚠️ meta.json esistente non valido, verrà sovrascritto");
    }
  }

  const combined = [...existing];
  newMetas.forEach(meta => {
    if (!combined.find(e => e.youtubeId === meta.youtubeId)) {
      combined.push(meta);
    }
  });

  fs.writeFileSync(META_PATH, JSON.stringify(combined, null, 2));
  console.log(`✅ meta.json aggiornato con ${newMetas.length} nuovi episodi`);

  // Cancella i file .info.json dopo l'uso
  files.forEach(file => {
    fs.unlinkSync(path.join(OUTPUT_DIR, file));
  });
  console.log(`🧹 Pulizia completata: rimossi ${files.length} file .info.json`);
} catch (err) {
  console.error("❌ Errore durante lo scraping:", err.message);
}
