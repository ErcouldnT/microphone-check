# 🎤 Microphone Check

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Expo](https://img.shields.io/badge/Expo-SDK%2054-000020.svg?logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB.svg?logo=react)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg?logo=typescript)](https://www.typescriptlang.org)
[![WebSocket](https://img.shields.io/badge/Real--Time-WebSocket-00FFFF.svg)](https://cal.erkut.dev)

**Microphone Check** is a modern, cyberpunk/neon-styled mobile application built with React Native (Expo) to track daily visits, sessions, or microphone checks. It features **real-time shared calendar synchronization**, allowing friends or partners to pair and update a joint calendar simultaneously over WebSockets.

---

## ✨ Features

- 📅 **Interactive Calendar:**
  - Tap any day to increment the count (+1) or long-press to decrement (-1).
  - Visual badge counters with glowing neon accents.
- ⚡ **Real-Time Shared Calendar (Ortak Takvim):**
  - **Pair with a Friend:** Generate a 6-character room code (e.g. `MIC-7492`) or join an existing room.
  - **Live WebSocket Sync:** Instant screen updates across both devices as soon as either person taps a date.
  - **Local-First & Offline Resilience:** Optimistic UI with Expo SQLite local storage — works seamlessly offline and automatically reconciles when reconnected.
  - **Status Indicator:** Real-time visual connection pill (🟢 Live / 🟡 Connecting / 🔴 Offline / ⚪ Local Mode).
- 📈 **Comprehensive Statistics:**
  - Total days visited & total microphone checks.
  - Daily records and most active month analysis.
  - Recent activity log with localized timestamps.
- 💾 **Data Management:**
  - **Export:** Backup your entire calendar data as formatted JSON.
  - **Import:** Restore or merge backed-up JSON data.
- 🌐 **Multi-Language Support (i18n):**
  - 🇹🇷 Turkish (Türkçe)
  - 🇬🇧 English
  - 🇷🇺 Russian (Русский)
  - Auto-detects device language with fallback.
- 🎨 **Neon Cyberpunk Aesthetic:**
  - Dark-mode first design with `#00FFFF` (Neon Cyan) and `#FF007F` (Neon Pink) accents powered by NativeWind v4 (Tailwind CSS).

---

## 🛠️ Tech Stack

### Mobile Client
- **Framework:** [Expo](https://expo.dev/) (SDK 54) & [React Native 0.81](https://reactnative.dev/)
- **Routing:** [Expo Router](https://docs.expo.dev/router/introduction/) (Typed file-based routing)
- **Local Storage:** [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) & [Drizzle ORM](https://orm.drizzle.team/)
- **Styling:** [NativeWind v4](https://www.nativewind.dev/) (Tailwind CSS)
- **Real-Time Client:** WebSocket client with auto-reconnection and heartbeat
- **Localization:** [i18n-js](https://github.com/fnando/i18n-js) & [expo-localization](https://docs.expo.dev/versions/latest/sdk/localization/)

### Backend Sync Server (`server/`)
- **Runtime:** Node.js & TypeScript
- **Networking:** Express REST API & [ws](https://github.com/websockets/ws) WebSocket Server
- **Database:** SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) with WAL mode and persistent volume
- **Deployment:** Docker & Docker Compose (Optimized for Coolify / VPS)

---

## 🚀 Getting Started (Mobile App)

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+ recommended)
- [npm](https://www.npmjs.com/)
- [Expo Go](https://expo.dev/client) app on your mobile device or an Android/iOS emulator

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ErcouldnT/microphone-check.git
   cd microphone-check
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Expo development server:
   ```bash
   npx expo start
   ```

4. Scan the QR code using Expo Go (Android) or the Camera app (iOS).

---

## 🐳 Self-Hosting the Sync Backend (Docker / Coolify)

You can host your own real-time sync server using the included `docker-compose.yml`:

```bash
cd microphone-check
docker compose up -d
```

### Deploying to Coolify
1. In your Coolify dashboard, create a new resource using your Git repository or Docker Compose.
2. Set your custom domain (e.g. `cal.erkut.dev`) mapped to port `3000`.
3. Coolify automatically manages Let's Encrypt SSL certificates and WebSocket reverse proxying.

---

## 📱 Releases & APK

Download the latest pre-built Android APK directly from the [GitHub Releases](https://github.com/ErcouldnT/microphone-check/releases) page.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

Developed with ❤️ by [ercode](https://github.com/ErcouldnT).
