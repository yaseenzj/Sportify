import json
import re
import os
import requests

def scrape_data():
    # Try finding channels.json in different standard paths
    possible_paths = [
        "channels.json",
        os.path.join("..", "data", "channels.json"),
        os.path.join("data", "channels.json"),
        os.path.join("desktop-app", "scripts", "channels.json")
    ]
    
    channels_path = None
    for p in possible_paths:
        if os.path.exists(p):
            channels_path = p
            break
            
    if not channels_path:
        # Fallback to default name in current folder
        channels_path = "channels.json"
        
    print(f"Loading sources from: {channels_path}")
    try:
        with open(channels_path, "r") as f:
            sources = json.load(f)
    except FileNotFoundError:
        print(f"Error: {channels_path} not found. Please create it first.")
        return

    playlist = {}
    headers = {'User-Agent': 'Mozilla/5.0'}

    for item in sources:
        try:
            print(f"Scraping {item['id']}...")
            response = requests.get(item['source_url'], headers=headers, timeout=15)
            html = response.text

            # Regex to find the MPD URL
            mpd_match = re.search(r'["\'](https?://[^\s\'"]+\.mpd.*?)["\']', html)
            # Regex to find keyId and key (32-char hex)
            key_id_match = re.search(r'["\']?keyId["\']?:\s*["\']([a-f0-9]{32})["\']', html)
            key_match = re.search(r'["\']?key["\']?:\s*["\']([a-f0-9]{32})["\']', html)

            if mpd_match and key_id_match and key_match:
                playlist[item['id']] = {
                    "url": mpd_match.group(1),
                    "clearKeys": {
                        key_id_match.group(1): key_match.group(1)
                    }
                }
                print(f"✅ Success: {item['id']}")
            else:
                print(f"⚠️ Failed to find data for {item['id']}")

        except Exception as e:
            print(f"❌ Error on {item['id']}: {e}")

    # Determine output path: output to data/ if channels was in data/, or same folder
    out_dir = os.path.dirname(channels_path)
    output_path = os.path.join(out_dir, "updated_playlist.json") if out_dir else "updated_playlist.json"
    
    print(f"Saving updated playlist to: {output_path}")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(playlist, f, indent=4)

if __name__ == "__main__":
    scrape_data()
