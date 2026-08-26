# 🎤 Microphone Check (v3.0.0)

<div align="center">
  <img src="./assets/images/logo.png" width="140" height="140" alt="Microphone Check Logo" style="border-radius: 28px; box-shadow: 0 0 20px #00FFFF;" />
  <br/><br/>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Expo](https://img.shields.io/badge/Expo-SDK%2054-000020.svg?logo=expo)](https://expo.dev)
  [![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB.svg?logo=react)](https://reactnative.dev)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg?logo=typescript)](https://www.typescriptlang.org)
  [![WebSocket](https://img.shields.io/badge/Real--Time-WebSocket-00FFFF.svg)](https://cal.erkut.dev)
  [![Push Notifications](https://img.shields.io/badge/Push-APNs%20%7C%20FCM%20v1-FF007F.svg)](https://expo.dev)
</div>

<br/>

**Microphone Check** is an ultra-modern, cyberpunk-styled shared couple calendar and tracker built with React Native (Expo). It connects partners through seamless real-time WebSocket synchronization, cross-platform push notifications (Apple APNs & Google FCM v1), interactive multi-view calendar scheduling, milestone relationship counters, and synchronized daily notes.

---

## ⚡ What's New in v3.0.0

- 🥷 **Cyber Ninja Couple Logo & Animated Splash Screen:**
  - Modern geometric vector iconography featuring Neon Cyan (male silhouette) and Neon Pink (female silhouette) cyber ninjas with glowing visors.
  - Fluid animated splash screen powered by `react-native-reanimated` with glow pulsing, zoom-in, and graceful fade-out transitions.
- 🛡️ **API Key Security Architecture:**
  - Protected backend REST endpoints (`/api/*`) and WebSocket handshake authentication with `X-API-Key`.
  - Configurable server settings and custom API key support directly in the mobile UI.
- 📱 **Unified Day Action Dialog (Native Multi-Tab Popup):**
  - Replaces fragmented bottom sheets with a centered, keyboard-friendly dialog.
  - **Tabs:**
    1. 📅 **Plan / Event:** Multi-day date ranges, time pickers, personalized assignees (`Sen 👨 / Partnerin 👩 / İkimiz ✨`), and color tags.
    2. 📝 **Daily Note:** Formatted multi-line daily notes shared instantly with your partner.
    3. 🔢 **Day Session Counter:** Neon counter with rapid increment/decrement.
    4. ⭐ **Relationship Counter:** Count days since anniversary or countdown to upcoming trips.
- 🔔 **Intelligent Self-Exclusion Push Notifications:**
  - When you add or edit a plan, note, or counter, push notifications are dispatched **only to your partner's devices**, never echoing back to yourself.
  - Push deduplication engine ensures zero duplicate notifications on iOS lock screens.

---

## ✨ Core Features

- 📅 **Triple-Mode Calendar Views:**
  - **Month View:** Monthly overview with day badges, counters, and event indicators.
  - **Week View:** Horizontal day strip with event timeline and active day statistics.
  - **Day View:** Hourly timetable with quick schedule overview.
- 👥 **Role & Member Filtering:**
  - Filter calendar events by **All**, **You (Sen)**, **Partner (Partnerin)**, or **Both (İkimiz)**.
- 💖 **Milestone Relationship Counters:**
  - Track anniversaries (*Days Together*), countdowns (*Days Left until Flight*), and special milestones with custom emojis.
- 🔔 **Lock Screen Push Notifications (Even When Closed):**
  - Native **Apple APNs** for iOS and **Google Firebase Cloud Messaging (FCM v1)** for Android.
- 🌐 **Multi-Language Support (i18n):**
  - 🇹🇷 Turkish (Türkçe)
  - 🇬🇧 English
  - 🇷🇺 Russian (Русский)
- 💾 **Local-First & Offline Sync:**
  - Powered by Expo SQLite and Drizzle ORM. Works completely offline and reconciles with the server when connected.

---

## 🛠️ Architecture & Tech Stack

### Mobile Client
- **Framework:** [Expo SDK 54](https://expo.dev/) & [React Native 0.81](https://reactnative.dev/)
- **Navigation:** [Expo Router v6](https://docs.expo.dev/router/introduction/)
- **Database:** [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) & [Drizzle ORM](https://orm.drizzle.team/)
- **Styling:** [NativeWind v4](https://www.nativewind.dev/) (Tailwind CSS)
- **Animations:** [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/)
- **Push:** [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/) (APNs + FCM v1)

### Backend Sync Server (`server/`)
- **Runtime:** Node.js & TypeScript
- **Server:** Express & [ws](https://github.com/websockets/ws)
- **Database:** SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) with WAL mode
- **Push Dispatcher:** Expo HTTP/2 Push API with ticket & receipt tracking
- **Security:** API Key middleware & WebSocket auth verification

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+ recommended)
- [npm](https://www.npmjs.com/)
- [Xcode](https://developer.apple.com/xcode/) (for iOS builds) or [Android Studio](https://developer.android.com/studio) (for Android builds)

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

3. Start development server:
   ```bash
   npx expo start
   ```

---

## 📱 Releases & APK

Download the latest pre-built Android APK directly from the [GitHub Releases](https://github.com/ErcouldnT/microphone-check/releases) page.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

Developed with ❤️ by [ercode](https://github.com/ErcouldnT).
