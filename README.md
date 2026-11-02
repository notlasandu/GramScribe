# GramScribe 🎙️⚡
### Instagram Post Scraper, Reel Audio Transcriber & Side Panel Assistant for Chrome

[![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?style=flat-square&logo=google-chrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

**GramScribe** is a browser extension (Manifest V3) that extracts clean, structured JSON from Instagram posts, transcribes Reels audio into formatted text with Whisper AI, and provides a native side panel visual browser.

---

## ⚡ Installation Options

### Option 1: Drag & Drop the Packed File (`.crx`)
1. Download **`GramScribe.crx`** from [Releases](../../releases).
2. Open your browser and go to `chrome://extensions/` (or `brave://extensions/`, `edge://extensions/`).
3. Turn **ON** **Developer mode** (toggle in the top-right corner).
4. **Drag and drop** the `GramScribe.crx` file onto the extensions page.
5. Click **Add extension** when prompted. Done!

---

### Option 2: 1-Click Setup Helper (Windows)
1. Download and extract **`GramScribe.zip`** from [Releases](../../releases).
2. **Double-click `install.bat`** inside the folder (opens `chrome://extensions/` automatically).
3. In Chrome:
   - Turn **ON** **Developer mode** (top-right toggle).
   - Click **Load unpacked** (top-left).
   - Select the extracted `GramScribe` folder.

---

### Option 3: Manual Installation (Chrome, Brave, Edge, Arc)
Works on any Chromium browser (Windows, macOS, Linux):

1. **Get the files**:
   - Download and unzip **`GramScribe.zip`** from [Releases](../../releases), OR clone this repository:
     ```bash
     git clone https://github.com/notlasandu/GramScribe.git
     ```
2. **Open Extensions Manager**:
   - **Chrome**: `chrome://extensions/`
   - **Brave**: `brave://extensions/`
   - **Edge**: `edge://extensions/`
3. **Turn on Developer Mode**:
   - Toggle **Developer mode** in the top-right corner.
4. **Load the Extension**:
   - Click **Load unpacked** in the top-left menu.
   - Choose the `GramScribe` folder containing `manifest.json`.
5. **Pin to Toolbar**:
   - Click the puzzle icon (🧩) in the browser toolbar and pin **GramScribe**.

---

## ✨ Features

### 🎙️ 1. In-Post Reel Audio Transcription
- **Native Action Bar Button**: A clean microphone icon appears in the action bar of every Reel post next to Like, Comment, and Share.
- **In-Modal Transcript Tab**: Click the mic icon to reveal a formatted transcript directly over the caption area without leaving the page.
- **Smart Filtering**: Excludes carousels and multi-slide posts automatically, ensuring transcripts are only queried for video Reels.
- **Persistent Storage**: Transcripts are saved persistently in browser storage across refreshes.

### 📋 2. Instant Single-Post JSON Copying
- 1-click **Copy JSON** icon right in the bottom action bar.
- Extracts author info, post shortcode, post URL, caption, timestamp, like/comment counts, media URLs, hashtags, and any transcribed audio into formatted JSON.
- Instantly syncs the post to the Side Panel.

### ⚡ 3. Profile Batch Scraper
- Native **Grab Posts** button appears right on any Instagram user profile next to the Similar Accounts button.
- Choose your target count (e.g., 20, 50, 100 posts) and scraping speed.
- Real-time progress HUD with live post counters and safety Pause/Stop buttons.
- On completion, the **Chrome Side Panel automatically opens** with a full summary.

### 🖼️ 4. Native Chrome Side Panel
- True dark-theme Instagram side dock.
- Displays post cards with thumbnails, metrics, 2-line captions, and reel badges.
- **Batch Summary Card**: Shows total scraped posts, total likes, video count, photo count, and top hashtags.
- **Transcribe All Reels**: Automatically triggers transcription for all Reels in the scraped batch.
- **Export Options**: One-click **Copy Full JSON** or **Download JSON** export.

---

## 🔒 Privacy & Security

- **Zero Tracking**: GramScribe does not track user behavior or send personal browsing data anywhere.
- **No Credentials Required**: GramScribe runs entirely in your browser session using standard client-side DOM parsing. No passwords, tokens, or login keys are required or stored.
- **Local Storage**: All scraped data and transcripts reside locally in your browser (`chrome.storage.local`).

---

## 🛠️ Project Structure

```text
GramScribe/
├── manifest.json       # Manifest V3 configuration & permissions
├── background.js       # Service worker handling sidepanel & transcription
├── content.js          # DOM extraction, HUD, action bar buttons & panel
├── content.css         # Styling for buttons, HUD, animations & transcript panel
├── sidepanel.html      # Side panel UI layout
├── sidepanel.js        # Side panel controller, batch summary & rendering
├── sidepanel.css       # Native dark theme styling for side panel
├── install.bat         # 1-click Windows setup helper
├── icons/              # Extension icons (16px, 32px, 48px, 128px)
└── README.md           # Documentation & instructions
```

---

## 📄 License

MIT License. Free for personal and commercial use.
