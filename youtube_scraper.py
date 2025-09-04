#!/usr/bin/env python3
import yt_dlp
import json
import time
import hashlib

def create_tt_id(video_id, channel_name):
    """Crea un ID unico che inizia con tt- per Stremio"""
    channel_hash = hashlib.md5(channel_name.encode()).hexdigest()[:6]
    return f"tt{channel_hash}{video_id}"

def get_channel_videos(channel_url, max_videos=15):
    ydl_opts = {
        'extract_flat': True,
        'dump_single_json': True,
        'quiet': True,
        'playlistend': max_videos,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            result = ydl.extract_info(channel_url, download=False)
            return result.get('entries', [])
    except Exception as e:
        print(f"❌ Errore: {e}")
        return []

def get_video_details(video_urls, channel_name, max_videos=10):
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
    }
    
    videos_data = []
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        for i, video_url in enumerate(video_urls[:max_videos]):
            try:
                print(f"📹 Processando video {i+1}/{len(video_urls)}")
                info = ydl.extract_info(video_url, download=False)
                
                youtube_id = info.get('id', '')
                tt_id = create_tt_id(youtube_id, channel_name)
                
                video_data = {
                    'id': tt_id,  # ✅ ID che inizia con tt
                    'youtubeId': youtube_id,
                    'title': info.get('title', 'No Title'),
                    'viewCount': info.get('view_count', 0),
                    'date': info.get('upload_date', '20240101'),
                    'duration': info.get('duration_string', '0:00'),
                    'channelName': info.get('channel', 'Unknown'),
                    'thumbnail': f"https://i.ytimg.com/vi/{youtube_id}/maxresdefault.jpg"
                }
                
                videos_data.append(video_data)
                print(f"   ID generato: {tt_id}")
                time.sleep(0.5)
                
            except Exception as e:
                print(f"❌ Errore: {e}")
                continue
    
    return videos_data

def main():
    print("🎬 YouTube Scraper per Stremio")
    print("=" * 50)
    
    channels = [
        "https://www.youtube.com/@PocoyoItaliano/videos",
        "https://youtube.com/channel/UCE4xFXIIllOpOoTynQ_4VUw",
        "https://youtube.com/channel/UCSKMTnvDepWI3OEaz-u1TXw",
        "https://youtube.com/channel/UCKfDlhFXXRzsaay_mCQBl0A",
        "https://youtube.com/channel/UC8WZSjUiavW7u-LOnjqql2w",
    ]
    
    all_videos = []
    
    for channel_url in channels:
        print(f"\n🔍 Scraping: {channel_url}")
        
        videos = get_channel_videos(channel_url)
        if not videos:
            continue
            
        video_urls = [f"https://www.youtube.com/watch?v={v['id']}" for v in videos if 'id' in v]
        print(f"📺 Trovati {len(video_urls)} video")
        
        video_details = get_video_details(video_urls, channel_url, max_videos=8)
        all_videos.extend(video_details)
        print(f"✅ Aggiunti {len(video_details)} video")

    if all_videos:
        with open('meta.json', 'w', encoding='utf-8') as f:
            json.dump(all_videos, f, ensure_ascii=False, indent=2)
        print(f"\n🎉 Salvati {len(all_videos)} video in meta.json")
    else:
        print("❌ Nessun video trovato")

if __name__ == "__main__":
    main()
