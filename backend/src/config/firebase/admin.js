const fs = require('fs');
const path = require('path');
const { initializeApp, getApps, cert, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const config = require('../env');
const logger = require('../../utils/logger');

let app;

function initFirebaseAdmin() {
  if (getApps().length > 0) {
    app = getApps()[0];
    return app;
  }

  const projectId = config.firebase.projectId;
  let credential;

  // 1. Check direct JSON string in env
  if (config.firebase.serviceAccountKeyJson) {
    try {
      const parsed = JSON.parse(config.firebase.serviceAccountKeyJson);
      credential = cert(parsed);
      logger.info('Firebase Admin initialized with JSON from environment variable');
    } catch (e) {
      logger.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON, falling back');
    }
  }

  // 2. Check path in env
  if (!credential && config.firebase.serviceAccountPath) {
    const fullPath = path.resolve(process.cwd(), config.firebase.serviceAccountPath);
    if (fs.existsSync(fullPath)) {
      credential = cert(require(fullPath));
      logger.info(`Firebase Admin initialized with service account from ${config.firebase.serviceAccountPath}`);
    }
  }

  // 3. Check serviceAccountKey.json in root
  if (!credential) {
    const defaultKeyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(defaultKeyPath)) {
      credential = cert(require(defaultKeyPath));
      logger.info('Firebase Admin initialized with local serviceAccountKey.json');
    }
  }

  // 4. Check clientEmail & privateKey in env
  if (!credential && config.firebase.clientEmail && config.firebase.privateKey) {
    credential = cert({
      projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey
    });
    logger.info('Firebase Admin initialized with env clientEmail and privateKey');
  }

  // 5. Try Application Default Credentials (ADC) or project-only initialization (e.g. for emulators)
  if (!credential) {
    try {
      // applicationDefault() does not fail eagerly, so report what is actually available
      credential = applicationDefault();
      if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
        logger.info('Firebase Admin using local emulators (no credentials required)');
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.K_SERVICE || process.env.GAE_SERVICE) {
        logger.info('Firebase Admin initialized with Application Default Credentials');
      } else {
        logger.warn(
          'No Firebase service account configured. Firestore and Auth calls will fail unless gcloud ADC is set up ' +
            '(set FIREBASE_SERVICE_ACCOUNT_PATH in .env).'
        );
      }
    } catch (err) {
      // In local development or testing without ADC, initialize with project ID (works with emulator)
      logger.warn(
        `Firebase Admin initialized with projectId: ${projectId} (without explicit service account cert). Suitable for Emulator or ADC environments.`
      );
    }
  }

  const appOptions = {
    projectId,
    storageBucket: config.firebase.storageBucket
  };

  if (credential) {
    appOptions.credential = credential;
  }

  app = initializeApp(appOptions);
  return app;
}

const firebaseApp = initFirebaseAdmin();
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// Configure Firestore settings if needed
try {
  db.settings({ ignoreUndefinedProperties: true });
} catch (e) {
  // Ignore if already set
}

module.exports = {
  firebaseApp,
  auth,
  db
};
