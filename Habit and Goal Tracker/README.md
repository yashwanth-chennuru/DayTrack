# DayTrack

A minimalist personal habit and goal tracker with deadline-based WhatsApp-style reminders delivered via Matrix. Built for one person, runs entirely for free.

> Built with [Antigravity](https://antigravity.google) — an agentic AI coding assistant by Google DeepMind.

---

## What it does

- **Track habits and goals** day by day with a clean, fast web UI
- **Set optional deadlines** on any habit or goal (e.g. "Fill water bottles — by 8:00 PM")
- **Get nagged automatically** — starting 1 hour before the deadline, you receive a reminder every 20 minutes via Matrix (Element app on your phone) until you mark it done
- **Works across devices** — the web app is hosted on Firebase, accessible from any browser

---

## Tech Stack

| Layer | Tech | Cost |
|---|---|---|
| **Frontend** | React + Vite + TypeScript | Free |
| **Hosting** | Firebase Hosting | Free (Spark plan) |
| **Database** | Firestore | Free (Spark plan) |
| **Auth** | Firebase Google Sign-In | Free |
| **Reminders** | Matrix HTTP API (matrix.org) | Free |
| **Cron runner** | Node.js script on a self-hosted machine | Free |

**Total monthly cost: $0.00**

---

## Architecture

```
You (browser / iPhone)
        │
        ▼
DayTrack Web App  ──read/write──▶  Firestore (Firebase)
                                         ▲
                                         │ reads every 20 min
                                         │
                              Arduino UNO Q / SBC
                              (Node.js cron script)
                                         │
                                         │ HTTP POST
                                         ▼
                                    matrix.org
                                         │
                                         │ push notification
                                         ▼
                                   Element app
                                  (your iPhone)
```

---

## Prerequisites

- A [Firebase](https://firebase.google.com) account (free)
- A [matrix.org](https://matrix.org) account for yourself + one for the bot (free)
- The **Element** app installed on your phone ([iOS](https://apps.apple.com/app/element/id1083446067) / [Android](https://play.google.com/store/apps/details?id=im.vector.app))
- Node.js v18+ installed on your machine
- A self-hosted machine to run the cron script (see options below)

---

## Part 1 — Deploy the Web App

### Step 1: Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/daytrack.git
cd daytrack
```

### Step 2: Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com) → **Add project**
2. Give it a name (e.g. `daytrack-myname`)
3. Enable Google Analytics if you want, or skip it

### Step 3: Enable Firebase services

In your Firebase project:

1. **Authentication** → Sign-in method → Enable **Google**
2. **Firestore Database** → Create database → Start in **production mode** → choose a region close to you
3. **Hosting** → Get started (follow the prompts, you'll deploy in a moment)

### Step 4: Get your Firebase config keys

1. Project Settings (gear icon) → General tab → scroll to **Your apps**
2. Click **Add app** → Web (`</>`)
3. Register the app — copy the `firebaseConfig` object shown

### Step 5: Set up environment variables

```bash
cd "Habit and Goal Tracker"
cp .env.example .env
```

Open `.env` and fill in the values from the `firebaseConfig` you just copied:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### Step 6: Set Firestore security rules

In Firebase Console → Firestore → **Rules**, paste this:

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

This ensures only the logged-in user can read/write their own data.

### Step 7: Install dependencies and deploy

```bash
npm install
npm run build
npx firebase login
npx firebase deploy --only hosting --project your-project-id
```

Your app is now live at `https://your-project-id.web.app` 🎉

---

## Part 2 — Set Up Matrix Reminders

### Step 1: Create a bot account

1. Go to [app.element.io](https://app.element.io)
2. Click **Create Account** on the `matrix.org` server
3. Username: something like `daytrack-bot` (write it down)
4. Note your full Matrix ID: `@daytrack-bot:matrix.org`

### Step 2: Get a bot access token

Run this in your terminal, replacing the username and password:

```bash
curl -X POST "https://matrix.org/_matrix/client/v3/login" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "m.login.password",
    "user": "daytrack-bot",
    "password": "YOUR_BOT_PASSWORD"
  }'
```

Copy the `access_token` value from the response (starts with `mct_` or `syt_`).

### Step 3: Set up Element on your phone

1. Download the **Element** app
2. Create your **personal** Matrix account (separate from the bot)
3. Create a **Private Room** called `DayTrack Reminders`
4. **Invite** `@daytrack-bot:matrix.org` to the room
5. Accept the invite from the bot's account at [app.element.io](https://app.element.io)
6. Get the **Room ID**: open the room on the desktop → Room Settings → Advanced → Internal Room ID (looks like `!abc123:matrix.org`)
7. In Element on your phone, set notifications for this room to **All messages**

### Step 4: Get a Firebase Service Account key

1. Firebase Console → Project Settings → **Service Accounts** tab
2. Click **Generate new private key** → download the JSON file
3. Rename it to `service-account.json`

---

## Part 3 — Deploy the Cron Script

### Option A: Self-hosted machine (100% free, recommended) 🏠

> Any always-on Linux device works — a Raspberry Pi, Arduino UNO Q, old laptop, or any SBC (Single Board Computer) running Linux with Node.js installed.

**Copy the script files to your machine:**

```bash
scp daytrack-reminder/.env.example \
    daytrack-reminder/reminder.mjs \
    daytrack-reminder/package.json \
    daytrack-reminder/install.sh \
    service-account.json \
    USER@YOUR_MACHINE_IP:~/daytrack-reminder/
```

**SSH into your machine and set up:**

```bash
ssh USER@YOUR_MACHINE_IP
cd ~/daytrack-reminder

# Fill in your credentials
cp .env.example .env
nano .env   # or use any text editor

# Install dependencies
npm install

# Install the cron job (runs every 20 minutes automatically)
chmod +x install.sh && ./install.sh

# Set your local timezone so reminders fire at the right time
sudo timedatectl set-timezone Asia/Kolkata   # change to your timezone
```

**Fill in `.env`:**

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_USER_UID=your-firebase-uid  # Firebase Console → Auth → Users → copy UID
MATRIX_ACCESS_TOKEN=mct_xxxxxxxxxxxxx
MATRIX_ROOM_ID=!your-room-id:matrix.org
```

That's it. The cron job will run every 20 minutes, forever. ✅

---

### Option B: Firebase Cloud Functions (no hardware needed) ☁️

> No self-hosted machine? No problem. Firebase Cloud Functions can run the same cron script in Google's cloud. For a single personal user, the free-tier limits are so generous that **you will very likely never pay a cent** — but Firebase does require you to upgrade to the **Blaze (pay-as-you-go) plan** and add a credit card.
>
> **In numbers:** Your script runs ~2,160 times/month. Firebase gives you 2,000,000 free runs/month. You'd use 0.1% of your allowance — effectively $0.00/month.

#### Firebase Functions setup

```bash
cd "Habit and Goal Tracker"
npx firebase init functions   # choose JavaScript, say yes to ESLint
cd functions
npm install firebase-admin node-fetch
```

Create `functions/index.js`:

```js
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

admin.initializeApp();
const db = admin.firestore();

const UID = process.env.FIREBASE_USER_UID;
const MATRIX_TOKEN = process.env.MATRIX_ACCESS_TOKEN;
const MATRIX_ROOM = process.env.MATRIX_ROOM_ID;

exports.reminderCheck = onSchedule("every 20 minutes", async () => {
  const todayStr = new Date().toISOString().split("T")[0];
  const docRef = db.collection("users").doc(UID).collection("days").doc(todayStr);
  const docSnap = await docRef.get();
  if (!docSnap.exists) return;

  const data = docSnap.data();
  const items = [...(data.habits || []), ...(data.goals || [])];
  const now = new Date();

  for (const item of items) {
    if (!item.deadline || item.done) continue;
    const [h, m] = item.deadline.split(":");
    const deadlineDate = new Date();
    deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
    const minDiff = Math.floor((deadlineDate - now) / 60000);
    if (minDiff <= 60) {
      const msg = minDiff > 0
        ? `⏰ Upcoming: ${item.text} — deadline in ${minDiff} min!`
        : `🚨 OVERDUE: ${item.text} — was due at ${item.deadline}!`;
      await fetch(`https://matrix.org/_matrix/client/v3/rooms/${encodeURIComponent(MATRIX_ROOM)}/send/m.room.message`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${MATRIX_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ msgtype: "m.text", body: msg })
      });
    }
  }
});
```

Set environment variables:
```bash
npx firebase functions:secrets:set FIREBASE_USER_UID
npx firebase functions:secrets:set MATRIX_ACCESS_TOKEN
npx firebase functions:secrets:set MATRIX_ROOM_ID
```

Deploy:
```bash
npx firebase deploy --only functions --project your-project-id
```

---

## Reminder Logic

| Time | Behaviour |
|---|---|
| More than 1 hour before deadline | 🤫 Silence |
| Within 1 hour of deadline (not done) | 🔔 First reminder sent |
| Every 20 minutes after that (not done) | 🔔 Repeated reminder |
| After deadline (not done) | 🚨 Overdue alert every 20 minutes |
| Marked as done | ✅ Reminders stop immediately |

---

## Project Structure

```
New Tracker/
├── Habit and Goal Tracker/      # The React web app
│   ├── src/
│   │   └── app/
│   │       ├── App.tsx          # Main UI + deadline logic
│   │       ├── AuthProvider.tsx # Firebase Google Auth
│   │       ├── LoginScreen.tsx  # Login page
│   │       └── hooks/
│   │           ├── useFirestoreItems.ts  # Firestore read/write
│   │           └── firebase.ts           # Firebase init
│   ├── .env.example             # Template — copy to .env and fill in
│   ├── firebase.json            # Firebase Hosting config
│   └── firestore.rules          # Firestore security rules
│
└── daytrack-reminder/           # The cron reminder script (runs on your SBC/machine)
    ├── reminder.mjs             # Main script — checks Firestore, sends Matrix messages
    ├── install.sh               # Sets up the cron job automatically
    ├── .env.example             # Template — copy to .env and fill in
    └── package.json
```

---

## Security Notes

- `.env` files and `service-account.json` are in `.gitignore` and will **never** be committed
- Firestore rules ensure only the authenticated user can access their own data
- The Matrix bot is in a private room — only you and the bot are members

---

## License

MIT — free to use, modify, and share.

---

*Built with [Antigravity](https://antigravity.dev) — an agentic AI coding assistant by Google DeepMind.*