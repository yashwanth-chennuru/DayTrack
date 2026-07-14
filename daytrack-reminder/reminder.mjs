import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env manually to avoid extra dependencies
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) process.env[match[1]] = match[2] || '';
  });
}

// 1. Config
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const UID = process.env.FIREBASE_USER_UID;
const MATRIX_TOKEN = process.env.MATRIX_ACCESS_TOKEN;
const MATRIX_ROOM = process.env.MATRIX_ROOM_ID;
const SENT_LOG_PATH = path.join(__dirname, 'sent.json');
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'service-account.json');

if (!UID || !MATRIX_TOKEN || !MATRIX_ROOM) {
  console.error("Missing required .env variables (FIREBASE_USER_UID, MATRIX_ACCESS_TOKEN, MATRIX_ROOM_ID).");
  process.exit(1);
}

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("Missing service-account.json. Please download it from Firebase Console (Project Settings -> Service Accounts).");
  process.exit(1);
}

// 2. Initialize Firebase
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
initializeApp({
  credential: cert(serviceAccount),
  projectId: PROJECT_ID
});
const db = getFirestore();

// 3. Matrix Send Helper
async function sendMatrixMessage(body) {
  const url = `https://matrix.org/_matrix/client/v3/rooms/${encodeURIComponent(MATRIX_ROOM)}/send/m.room.message`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MATRIX_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        msgtype: 'm.text',
        body
      })
    });
    if (!res.ok) {
      console.error("Matrix API Error:", await res.text());
    } else {
      console.log("Sent Matrix message:", body);
    }
  } catch (err) {
    console.error("Failed to send Matrix message:", err);
  }
}

// 4. Load sent log to prevent spam
let sentLog = {};
const todayStr = new Date().toISOString().split('T')[0];
if (fs.existsSync(SENT_LOG_PATH)) {
  try {
    sentLog = JSON.parse(fs.readFileSync(SENT_LOG_PATH, 'utf-8'));
    // clear old days
    if (!sentLog[todayStr]) {
      sentLog = { [todayStr]: {} };
    }
  } catch(e) {}
} else {
  sentLog = { [todayStr]: {} };
}
const todayLog = sentLog[todayStr];

// 5. Check Habits
async function run() {
  console.log(`Checking habits for ${todayStr}...`);
  
  const docRef = db.collection('users').doc(UID).collection('days').doc(todayStr);
  const docSnap = await docRef.get();
  
  if (!docSnap.exists) {
    console.log("No data for today.");
    return;
  }
  
  const data = docSnap.data();
  const items = [...(data.habits || []), ...(data.goals || [])];
  
  let modifiedLog = false;
  const now = new Date();
  
  for (const item of items) {
    if (!item.deadline || item.done) continue;
    
    // Parse deadline "HH:mm"
    const [h, m] = item.deadline.split(':');
    const deadlineDate = new Date();
    deadlineDate.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
    
    const msDiff = deadlineDate.getTime() - now.getTime();
    const minDiff = Math.floor(msDiff / 60000);
    
    // Condition: Nag if within 60 mins of deadline OR if it's already overdue
    if (minDiff <= 60) {
      const lastSentTime = todayLog[item.id] || 0;
      const msSinceLastSent = now.getTime() - lastSentTime;
      const minSinceLastSent = Math.floor(msSinceLastSent / 60000);
      
      // If we haven't sent a reminder in the last 20 mins
      if (minSinceLastSent >= 20) {
        let msg = "";
        if (minDiff > 0) {
          msg = `⏰ Upcoming: ${item.text} — deadline in ${minDiff} min!`;
        } else {
          msg = `🚨 OVERDUE: ${item.text} — was due at ${item.deadline}!`;
        }
        
        await sendMatrixMessage(msg);
        
        // Update log
        todayLog[item.id] = now.getTime();
        modifiedLog = true;
      }
    }
  }
  
  if (modifiedLog) {
    fs.writeFileSync(SENT_LOG_PATH, JSON.stringify(sentLog, null, 2));
  }
  
  console.log("Check complete.");
  process.exit(0);
}

run().catch(console.error);
