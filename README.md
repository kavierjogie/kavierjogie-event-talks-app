# BigQuery Release Notes Explorer & X/Twitter Sharer 🚀

A modern, high-fidelity web application built using **Python Flask** and **Vanilla HTML/CSS/JavaScript**. It fetches Google BigQuery's official release notes XML feed, parses the contents into individual category-based cards (Features, Issues, Deprecated, etc.), and allows you to customize and share them directly on X (formerly Twitter).

---

## 🌟 Features

* **Smart Feed Splitting**: Parses Google's multi-update daily release notes XML and splits them into individual, self-contained cards.
* **Modern Developer Dashboard**: Glassmorphic UI with responsive design, ambient gradient pulses, and dark mode by default.
* **Instant Keyword Search**: Live client-side text filtering as you type.
* **Interactive Category Pills**: Filter updates dynamically by type (Features, Issues, Deprecated, etc.) and view counted summaries.
* **X/Twitter Composer Modal**:
  - Auto-truncates description text to stay within X's 280-character limit.
  - Interactive pill selectors to toggle hashtags (`#BigQuery`, `#GoogleCloud`, `#GCP`, etc.).
  - Circular SVG progress ring showing character count limits (blue ➔ orange ➔ red).
  - Quick-copy button or direct post opening a prefilled Twitter Web Intent popup.
* **In-Memory Caching**: 5-minute server-side caching prevents API request limits, with manual force-refresh capabilities.

---

## 🛠️ Built With

- **Backend**: Python 3, Flask, BeautifulSoup4, Requests
- **Frontend**: Vanilla HTML5, Vanilla CSS3 (Variables, Keyframe Animations, Glassmorphic effects), Vanilla JavaScript (ES6)
- **API Feed Source**: [Google Cloud BigQuery Release Notes Feed](https://docs.cloud.google.com/feeds/bigquery-release-notes.xml)

---

## 📁 Project Structure

```text
bigquery-release-notes/
├── app.py                 # Flask Server & BeautifulSoup Feed Parser
├── README.md              # Project Documentation
├── .gitignore             # Ignored Files & Folders
├── templates/
│   └── index.html         # UI HTML Structure & Modal Layout
└── static/
    ├── css/
    │   └── style.css      # Dark Mode Variables, Styling & Animations
    └── js/
        └── app.js         # API Fetching, Search Filters & Tweet Composer
```

---

## 🚀 How to Get Started

### 1. Prerequisites
Ensure you have **Python 3.8+** installed on your system. You can verify this by running:
```bash
python --version
```

### 2. Install Dependencies
Install the required packages using `pip`:
```bash
pip install flask requests beautifulsoup4
```
*(Or `python -m pip install flask requests beautifulsoup4` if pip is not on your PATH)*

### 3. Run the Server
Launch the Flask development server:
```bash
python app.py
```

### 4. Open in Browser
Once the server starts up, navigate to:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 📜 How it Works

### Backend Parsing (`app.py`)
Google's release notes feed groups multiple changes under a single date string (e.g., three features and one issue on June 15). The Python backend uses BeautifulSoup to iterate through the Atom XML nodes and parse each entry. It searches for `<h3>` tags in the HTML body and partitions siblings (like paragraphs and lists) into separate update structures:
```json
{
  "id": "entry-id-hash_0",
  "date": "June 15, 2026",
  "type": "Feature",
  "content_html": "<p>...</p>",
  "plain_text": "..."
}
```

### X/Twitter Integration (`app.js`)
When you click the **Tweet** button on an update card, a custom composer opens. The app calculates:
$$\text{Available Body Length} = 280 - \text{Header Length} - \text{Hashtags Length}$$
It then safely truncates the update text and appends the active hashtags. Clicking **Post to X** triggers a secure window popup pointing to Twitter's web intent:
`https://twitter.com/intent/tweet?text=ENCODED_TEXT`
No Twitter API developer credentials or tokens are required!
