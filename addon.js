#!/usr/bin/env python3
import yt_dlp
import json
import time
import hashlib

def create_tt_id(video_id, channel_name):
    """Crea un ID unico che inizia con tt- per compatibilità Stremio"""
    # Usa l'ID video + hash del channel name per creare ID unico
    channel_hash = hashlib.md5(channel_name.encode()).hexdigest()[:6]
    return f"tt{channel_hash}{video_id}"

def get_channel_videos(channel_url, max_videos=20):
    ydl_opts = {
        'extract_flat': True,
        'dump_single_json': True,
        'quiet': True,
        'playlistend': max_videos,
        'skip_download': True,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            result = ydl.extract_info(channel_url, download=False)
            return result.get('entries', [])
    except Exception as e:
        print(f"❌ Error getting videos from {channel_url}: {str(e)[:100]}...")
        return []

def get_video_details(video_urls, channel_name, max_videos=10):
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
    }
    
    videos_data = []
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        for i, video_url in enumerate(video_urls[:max_videos]):
            try:
                print(f"📹 Processing video {i+1}/{min(len(video_urls), max_videos)}")
                info = ydl.extract_info(video_url, download=False)
                
                # Crea ID compatibile con Stremio che inizia con tt
                youtube_id = info.get('id', '')
                tt_id = create_tt_id(youtube_id, channel_name)
                
                video_data = {
                    'id': tt_id,  # ✅ ID che inizia con tt
                    'youtubeId': youtube_id,  # Conserva anche l'ID YouTube originale
                    'title': info.get('title', 'No Title'),
                    'url': info.get('webpage_url', ''),
                    'viewCount': info.get('view_count', 0),
                    'date': info.get('upload_date', '20240101'),
                    'likes': info.get('like_count', 0),
                    'channelName': info.get('channel', 'Unknown Channel'),
                    'channelUrl': info.get('channel_url', ''),
                    'duration': info.get('duration_string', '0:00'),
                    'thumbnail': f"https://i.ytimg.com/vi/{youtube_id}/maxresdefault.jpg"
                }
                
                videos_data.append(video_data)
                
                print(f"   Generated ID: {tt_id}")
                
                # Piccola pausa per evitare ban
                time.sleep(0.3)
                
            except Exception as e:
                print(f"❌ Error with {video_url}: {str(e)[:50]}...")
                continue
    
    return videos_data

def get_channel_name_from_url(channel_url):
    """Estrae il nome del canale dall'URL"""
    try:
        if '/channel/' in channel_url:
            return channel_url.split('/channel/')[-1].split('/')[0]
        elif '/@' in channel_url:
            return channel_url.split('/@')[-1].split('/')[0]
        elif 'youtube.com/' in channel_url:
            return channel_url.split('youtube.com/')[-1].split('/')[0]
        else:
            return hashlib.md5(channel_url.encode()).hexdigest()[:6]
    except:
        return "unknown"

def main():
    print("🎬 YouTube Scraper Started - TT Edition")
    print("=" * 50)
    print("🔧 Generating IDs that start with 'tt' for Stremio compatibility")
    print("=" * 50)
    
    # CANALI GARANTITI FUNZIONANTI
    channels = [
        # ✅ Canali principali
        "https://www.youtube.com/channel/UCwQ-5RSINDVfzfxyTtQPSww/videos",  # Pocoyo Italiano
        "https://www.youtube.com/channel/UCAOtE1V7Ots4DjM8JLlrYgg/videos",  # Peppa Pig Official
        "https://www.youtube.com/channel/UCgFk4aYNZN4HjMw9y9Exaog/videos",  # PJ Masks
        
        # ✅ Altri canali bambini
        "https://www.youtube.com/channel/UCQ4e0Y-_bD7gRaapz5i72wQ/videos",  # Paw Patrol
        "https://www.youtube.com/channel/UCfq1f4s12-a4Pj-MtQxQoWg/videos",  # Masha e Orso
        "https://www.youtube.com/channel/UCX7W2gU_7xOcGgrDp_4uJgw/videos",  # Bing
    ]
    
    all_videos = []
    
    for channel_url in channels:
        print(f"\n🔍 Scraping: {channel_url}")
        
        # Estrai nome canale per l'ID
        channel_id = get_channel_name_from_url(channel_url)
        print(f"   Channel ID: {channel_id}")
        
        videos = get_channel_videos(channel_url, max_videos=12)
        
        if not videos:
            print(f"⚠️ No videos found or access issues")
            continue
            
        video_urls = []
        for v in videos:
            if 'id' in v:
                video_urls.append(f"https://www.youtube.com/watch?v={v['id']}")
            elif 'url' in v:
                video_urls.append(v['url'])
        
        print(f"📺 Found {len(video_urls)} videos")
        
        if not video_urls:
            continue
            
        video_details = get_video_details(video_urls, channel_id, max_videos=8)
        all_videos.extend(video_details)
        
        print(f"✅ Added {len(video_details)} videos with tt IDs")
        
        # Pausa tra i canali
        time.sleep(1)

    # Salva in meta.json
    if all_videos:
        with open('meta.json', 'w', encoding='utf-8') as f:
            json.dump(all_videos, f, ensure_ascii=False, indent=2)
        
        print(f"\n🎉 SUCCESS! Saved {len(all_videos)} videos to meta.json")
        
        # Mostra esempi di ID generati
        print("\n📋 Sample generated IDs (start with 'tt'):")
        for i, video in enumerate(all_videos[:5]):
            print(f"   {i+1}. {video['id']} -> {video['title'][:30]}...")
        
        # Statistiche
        from collections import Counter
        channel_counts = Counter(video['channelName'] for video in all_videos)
        
        print("\n📊 Videos per channel:")
        for channel, count in channel_counts.most_common():
            print(f"   {channel}: {count} videos")
            
        print(f"\n💾 File saved: meta.json")
        print("   All IDs start with 'tt' for Stremio compatibility")
        
    else:
        print("❌ No videos were scraped")
        # Crea un file vuoto per evitare errori
        with open('meta.json', 'w', encoding='utf-8') as f:
            json.dump([], f)
        print("💾 Created empty meta.json")

if __name__ == "__main__":
    main()
