# PocketPet · AI Financial Companion

> Built for **BeU by Bank Islam × UMPSA Hackathon X Fintech Forward 2026**

---

## About PocketPet

PocketPet is an AI-powered financial companion that turns money management into an emotional, gamified experience. Users "take care" of a virtual pet — Mochi — whose health and evolution directly reflects their financial habits. The worse you spend, the sadder Mochi gets. The more you save and avoid scams, the stronger Mochi evolves.

Built for Malaysian Gen Z, PocketPet combines real-time expense tracking, AI-powered scam detection, a chat-based financial coach, daily quests, and a full XP/levelling system — all backed by Firebase and powered by Google Gemini.

---

## Key Features

* 🐾 **AI Pet Health System** — Mochi reacts and evolves based on users’ spending, saving, and financial habits
* 💸 **Smart Finance Tracking** — Expense logging, savings goals, budget management, and real-time spending insights
* 📊 **AI Analytics Dashboard** — Spending charts, financial health score, predictive analysis, and habit detection
* 🤖 **AI Financial Coach** — Personalized financial advice and emotional daily financial summaries powered by Gemini
* 🛡️ **ScamShield Protection** — AI scam detection, phishing link scanner, and scam awareness quiz system
* 🎮 **Gamification System** — XP, streaks, achievements, daily quests, and pet evolution rewards
* ☁️ **Cloud-Based System** — Firebase authentication with real-time cloud sync and secure user data storage


---

## Project Structure

```
pocketpet/
├── public/
│ ├── index.html
│ └── manifest.json
├── src/
│ ├── App.js        # All React components & logic
│ ├── App.css
│ ├── index.js
│ └── index.css
├── .env            # API keys (not commited)
├── package.json
└── README.md
```

---

## Tech Stack

| Layer | Tools |
|---|---|
| Frontend | React.js, inline CSS-in-JS, responsive layout |
| AI Engine | Google Gemini 2.5 Flash (`gemini-2.5-flash`) via REST API |
| Database | Firebase Firestore (real-time sync, per-user collections) |
| Auth | Firebase Authentication (email/password) |

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- A **Google Gemini API key** — [get one here](https://aistudio.google.com/app/apikey)
- A **Firebase project** — [create one here](https://console.firebase.google.com)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/pocketpet.git
cd pocketpet
npm install
```

### 2. Configure environment

Create a `.env` file in the root:

```env
REACT_APP_AI_KEY=your_gemini_api_key_here
REACT_APP_FB_API_KEY=your_firebase_api_key
REACT_APP_FB_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FB_PROJECT_ID=your_project_id
REACT_APP_FB_STORAGE_BUCKET=your_project.firebasestorage.app
REACT_APP_FB_MESSAGING_ID=your_messaging_sender_id
REACT_APP_FB_APP_ID=your_app_id
```

### 3. Firebase setup

In your Firebase Console:

1. Enable **Firestore Database**
2. Enable **Authentication** → Email/Password provider
3. Set Firestore Rules (development):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 4. Run the app

```bash
npm start
```

App runs at `http://localhost:3000`.

---

## Environment Variables

| Variable | Description |
|---|---|
| `REACT_APP_AI_KEY` | Google Gemini API key |
| `REACT_APP_FB_API_KEY` | Firebase project API key |
| `REACT_APP_FB_AUTH_DOMAIN` | Firebase auth domain |
| `REACT_APP_FB_PROJECT_ID` | Firestore project ID |
| `REACT_APP_FB_STORAGE_BUCKET` | Firebase storage bucket |
| `REACT_APP_FB_MESSAGING_ID` | Firebase messaging sender ID |
| `REACT_APP_FB_APP_ID` | Firebase app ID |

---

## AI Tools Used

> All AI tools used in this project are listed here.

| Tool | Purpose |
|---|---|
| **Google Gemini 2.5 Flash** | Core AI engine — pet feedback, scam detection, link safety scanning, AI financial coach, habit analysis, daily story generation, budget recommendations, AI tips |
| **Claude (Anthropic)** | Used during development for code generation, debugging, architecture decisions, and feature implementation assistance |

All AI-generated code was reviewed, understood, and modified by the team. We are able to explain every function, component, and logic flow in the codebase.