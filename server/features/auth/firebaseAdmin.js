const path = require('path');
const admin = require('firebase-admin');

function resolveServiceAccount() {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccountPath) {
    return require(path.resolve(serviceAccountPath));
  }

  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  return null;
}

function getFirebaseAdmin() {
  if (admin.apps.length) {
    return admin;
  }

  const serviceAccount = resolveServiceAccount();
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    admin.initializeApp();
  }

  return admin;
}

async function verifyFirebaseIdToken(idToken) {
  return getFirebaseAdmin().auth().verifyIdToken(idToken);
}

module.exports = {
  verifyFirebaseIdToken,
};
