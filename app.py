import os
import time
import re
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Cache store
_cache = {
    "data": None,
    "last_fetched": 0,
    "status": "idle",
    "error": None
}
CACHE_DURATION = 300  # 5 minutes in seconds

def fetch_and_parse_release_notes():
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    response = requests.get(url, headers=headers, timeout=15)
    response.raise_for_status()
    
    root = ET.fromstring(response.content)
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    
    updates = []
    for entry in root.findall("atom:entry", ns):
        title_el = entry.find("atom:title", ns)
        updated_el = entry.find("atom:updated", ns)
        content_el = entry.find("atom:content", ns)
        id_el = entry.find("atom:id", ns)
        
        date_str = title_el.text if title_el is not None else ""
        updated_str = updated_el.text if updated_el is not None else ""
        content_html = content_el.text if content_el is not None else ""
        entry_id = id_el.text if id_el is not None else ""
        
        soup = BeautifulSoup(content_html, 'html.parser')
        h3s = soup.find_all('h3')
        
        if not h3s:
            # Fallback if no h3 structure is found
            plain_text = soup.get_text(separator=' ', strip=True)
            plain_text = re.sub(r'\s+', ' ', plain_text)
            updates.append({
                "id": f"{entry_id}_0",
                "date": date_str,
                "updated": updated_str,
                "type": "General",
                "content_html": content_html,
                "plain_text": plain_text
            })
            continue
            
        for i, h3 in enumerate(h3s):
            update_type = h3.get_text(strip=True)
            sibling_html = []
            
            curr = h3.next_sibling
            while curr is not None and curr.name != 'h3':
                sibling_html.append(str(curr))
                curr = curr.next_sibling
                
            item_html = "".join(sibling_html).strip()
            item_soup = BeautifulSoup(item_html, 'html.parser')
            plain_text = item_soup.get_text(separator=' ', strip=True)
            plain_text = re.sub(r'\s+', ' ', plain_text)
            
            # Clean up potential leading/trailing quotes or punctuation if any
            updates.append({
                "id": f"{entry_id}_{i}",
                "date": date_str,
                "updated": updated_str,
                "type": update_type,
                "content_html": item_html,
                "plain_text": plain_text
            })
            
    return updates

def get_release_notes(force_refresh=False):
    now = time.time()
    if force_refresh or _cache["data"] is None or (now - _cache["last_fetched"]) > CACHE_DURATION:
        try:
            _cache["data"] = fetch_and_parse_release_notes()
            _cache["last_fetched"] = now
            _cache["status"] = "success"
            _cache["error"] = None
        except Exception as e:
            _cache["status"] = "error"
            _cache["error"] = str(e)
            if _cache["data"] is None:
                _cache["data"] = []
    return _cache

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/release-notes')
def api_release_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    cache_data = get_release_notes(force_refresh=force_refresh)
    
    # Return data and metadata
    return jsonify({
        "status": cache_data["status"],
        "error": cache_data["error"],
        "last_fetched": cache_data["last_fetched"],
        "data": cache_data["data"]
    })

if __name__ == '__main__':
    # Run Flask server locally on port 5000
    app.run(debug=True, host='127.0.0.1', port=5000)
