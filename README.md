<div align="center">
  <img src="desktop-app/src/assets/logo.png" alt="Sportify Logo" width="120" />
  <h1>Sportify</h1>
  <p>A modern, beautiful, and feature-rich desktop application for streaming live sports and managing M3U playlists.</p>
</div>

<br />

## 🌟 Features

- **Live Sports Hub**: Instantly view upcoming and live sports events across Football, Cricket, F1, MotoGP, Tennis, Golf, and more.
- **Custom M3U Support**: Paste your own M3U playlists to seamlessly watch custom IPTV streams within the app.
- **Stream Manager Dashboard**: A fully-fledged admin dashboard built on Cloudflare Workers to manage, edit, and organize your M3U streams by category. Includes automatic backups and version history!
- **User Profiles**: Secure PIN-based login system for multiple users, with customizable avatars and profile settings.
- **Beautiful UI**: Built with React, Vite, and Electron, featuring a premium dark mode aesthetic, glassmorphism, and smooth micro-animations.
- **Cloudflare Powered**: The backend is lightweight and serverless, powered entirely by Cloudflare Workers and Cloudflare KV.

## 📥 Download & Install

The easiest way to use Sportify is to download the pre-built desktop installer for Windows. 

1. **[Click here to go to the Releases page](https://github.com/yaseenzj/Sportify/releases/latest)**
2. Under the **Assets** section of the latest release, download the `Sportify-Setup-X.X.X.exe` file.
3. Run the `.exe` file to install the app. It will automatically keep itself updated!

---

## 🚀 Developers: Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Cloudflare Account](https://dash.cloudflare.com/) (For deploying the backend workers)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### 1. Clone the Repository
```bash
git clone https://github.com/yaseenzj/Sportify.git
cd Sportify
```

### 2. Setup the Frontend (Desktop App)
Navigate to the `desktop-app` directory and install dependencies:
```bash
cd desktop-app
npm install
```

Create your environment variables by copying the example file:
```bash
cp .env.example .env
```
Fill in the `.env` file with your deployed Cloudflare Worker URLs (see backend setup below) and any public JSON playlist URLs you wish to use.

Run the app locally in development mode:
```bash
npm run dev
```

### 3. Setup the Backend (Cloudflare Workers)
Navigate to the `workers` directory. You will need to deploy both the Auth Backend and the Stream Manager.

```bash
cd ../workers/cloudflare-stream-manager
npm install
wrangler deploy
```

**Important**: You must create a Cloudflare KV namespace and bind it as `SPORTIFY_STREAMS` in your `wrangler.toml` file.
You also need to set a secure Admin Password for the dashboard:
```bash
echo "your-secure-password" | npx wrangler secret put ADMIN_PASSWORD
```

## ⚖️ Legal Disclaimer

**Sportify** is purely a media player and management interface. 
- The creator of this repository does **NOT** host, provide, or distribute any media content, streams, or copyright-protected material.
- Any streams, JSON URLs, or M3U playlists provided as examples or defaults in the code (or used by the community) are sourced freely from the open-source internet.
- The creator assumes **zero responsibility** for the content that users choose to consume or manage using this software. Use this application at your own risk and ensure you comply with the copyright laws of your jurisdiction.

## 🤝 Contributing
Contributions are always welcome! Feel free to open a pull request or submit an issue if you find a bug or have a feature request.
