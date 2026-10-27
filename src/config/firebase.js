import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

// Firebase Admin is used only to send push notifications (FCM; iOS goes through APNs).
// FIREBASE_SERVICE_ACCOUNT holds the service-account JSON on ONE line in .env.
// Without valid credentials (e.g. local dev), messaging stays null and sends are skipped.
let messaging = null;

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (raw) {
  try {
    const serviceAccount = JSON.parse(raw);
    const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount) });
    messaging = getMessaging(app);
  } catch (error) {
    // Bad JSON must not stop the server; push is disabled until the key is fixed.
    console.error("Firebase disabled: FIREBASE_SERVICE_ACCOUNT is not valid service-account JSON:", error.message);
  }
}

export default messaging;
