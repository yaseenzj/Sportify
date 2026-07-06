# Sportify

A premium, open-source suite of sports streaming dashboards and players designed for the modern web and desktop.

Sportify features an elegant, high-performance UI built on React, featuring smooth micro-animations, glassmorphism design elements, and a robust media player.

## 🚀 Repository Structure

This repository is organized as a workspace holding the core frontend clients:

*   **`web-app/`**: A React + Vite web-based stream player. It parses M3U playlists, lists channels dynamically, and supports HLS (.m3u8), DASH (.mpd), and ClearKey DRM streams.
*   **`desktop-app/`**: A cross-platform Electron + React desktop application featuring customizable user profiles, secure PIN-based app locking, categorized streams, custom stream additions, global state settings, and full favorites syncing.
*   **`scripts/`**: Automation and scraper scripts for local stream management.
*   **`data/`** *(Gitignored)*: Consolidated folder for local channel configuration and cached playlists.

---

## 🔒 Security & Decoupled Architecture

Sportify's clients are **UI-only and entirely open source**. 

*   **Zero Exposed Playlists/Links**: There are no hardcoded M3U, MPD, HLS, or TS streaming links within this repository. 
*   **Decoupled Worker Backend**: All playlist retrieval, live link updates, and DRM key management happen securely via serverless workers (e.g., Cloudflare Workers). 
*   **API-Driven**: The clients fetch channels dynamically from the backend worker APIs.

---

## 🛠️ Getting Started

### 1. Web Player (`/web-app`)
A lightweight, browser-based media player.

```bash
cd web-app
npm install
npm run dev
```

### 2. Desktop Application (`/desktop-app`)
Electron-powered app for desktop systems.

```bash
cd desktop-app
npm install
npm run dev
```

---

## 📦 Building and Deployment

### Web Player (GitHub Pages)
The web player is configured to build using relative asset paths (`base: './'`), allowing it to run out-of-the-box on GitHub Pages or any static file hosting service.

### Desktop App
Build binaries for Windows, macOS, or Linux using Electron Builder:
```bash
cd desktop-app
npm run build
```
