# 🍃 SentiMed Web Portal

SentiMed is a secure, state-of-the-art dual desktop portal designed for mental health wellness tracking. It integrates biometric wearable telemetry, multimodal speech/video sentiment analytics, and cognitive behavioral therapy (CBT) reflection with clinician-supervised monitoring.

This repository features two primary systems:
1. **👤 Patient Web Portal**: A dashboard for mood tracking, biometrics, semantic-searchable journals, and interactive CBT-guided reflections.
2. **🩺 Clinician Care Coordinator Hub**: A diagnostic center for tracking wellness scores, patient status flags, and managing medical telemetry.

---

## ✨ Features

- **🔒 Dual Authentication & Registration Wizard**:
  - Secure Patient & Clinician access.
  - Interactive **4-step Patient Demographic & Clinical Intake registration wizard**.
  - **Google OAuth Popup Sign-in** integration.
- **🧬 Dynamic Wellness Scoring**:
  - Live ring chart indicating overall sentiment fused with HRV, sleep, and step metrics.
  - Interactive sliders to simulate wearable syncs.
- **🎙️ Multimodal Journaling**:
  - Support for text, voice, and video entries.
  - Live Sentiment Bar showing emotional distributions across modalities.
- **💬 CBT-Aligned AI Companion**:
  - Cognitive behavioral therapy conversational agent.
  - "Unsent Letter" space featuring a particle dissolution visual effect.
- **🔎 Semantic Memory Bank**:
  - Smart search over historic journals with text highlights.
- **🚨 Red Zone Distress Protocol**:
  - Automatic emergency triggers dispatching notifications to designated contacts and emergency emails.
- **🔐 Live and Sandbox modes**:
  - Live: **Firebase Authentication** in the browser; all data goes through the SentiMed Express API (`../backend`), which verifies the ID token and enforces roles and consent. The browser never accesses Firestore directly.
  - Sandbox: offline demo with localStorage data when Firebase is not configured.

---

## 🛠️ Tech Stack

- **Core**: React 19, JavaScript (ES6+)
- **Build Tool**: Vite 8
- **Styling**: Vanilla CSS (Harmonious HSL colors, responsive grid, glassmorphism card layouts)
- **Database / Auth**: Firebase Web SDK v12

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone <your-repository-url>
cd react-sc-folder
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run the development server
```bash
npm run dev
```

The app will start at `http://localhost:5173`.

---

## ⚙️ Firebase Setup & Configuration

This project is fully integrated with Firebase. To hook up your own active Firebase instance:

### Step A: Enable Providers in the Firebase Console
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your project (e.g., `sentimed-febc4`).
3. Click on **Authentication** in the left sidebar ➔ **Sign-in method**.
4. Click **Add new provider** ➔ **Email/Password** ➔ Enable and save it.
5. Click **Add new provider** ➔ **Google** ➔ Enable and save it (configure consent screen if prompted).
6. Click on **Firestore Database** in the left sidebar ➔ **Create database** (start in test mode or write rules).

### Step B: Configure environment variables
Copy `.env.example` to `.env.local` (git-ignored) and fill in the web app config. `VITE_API_BASE_URL` defaults to `/api`, which the Vite dev server proxies to the backend (`VITE_DEV_API_PROXY_TARGET`, default `http://localhost:5000`). Minimum keys:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

---

## ⚡ Development & Quality Verification

This project enforces strict ESLint rules and builds cleanly in under 150ms.

#### Run Linter
```bash
npm run lint
```

#### Build Production Bundle
```bash
npm run build
```

---

## 📂 Project Structure

```
├── dist/                  # Production build output
├── public/                # Static assets
├── src/
│   ├── assets/            # Global svg, styling resources
│   ├── components/
│   │     ├── AuthPortal.jsx           # Sign-in and 4-step intake form
│   │     ├── ClinicianPortal.jsx      # Doctor telemetry panel
│   │     ├── PatientPortal.jsx        # Patient wellness dashboard
│   │     └── NotificationSimulator.jsx # Diagnostic alerts simulator
│   ├── services/
│   │     └── firebase.js              # Live Firebase SDK & Local Sandbox fallback
│   ├── App.jsx            # Routing, alerts, and session listeners
│   ├── index.css          # Premium design token theme system
│   └── main.jsx           # App mounting point
├── .env.example           # Environment variables template
├── eslint.config.js       # ESLint rules
└── package.json           # Scripts & package configurations
```
