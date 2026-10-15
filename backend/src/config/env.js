const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env if present
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  // Comma-separated list of allowed browser origins (used outside development)
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'sentience-6f40e',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : '',
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
    serviceAccountKeyJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '',
    databaseLocation: process.env.FIREBASE_DATABASE_LOCATION || 'asia-south1',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'sentience-6f40e.firebasestorage.app',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'sentience-6f40e.firebaseapp.com',
    webApiKey: process.env.FIREBASE_WEB_API_KEY || ''
  },
  modelApi: {
    baseUrl: process.env.MODEL_API_BASE_URL || '',
    apiKey: process.env.MODEL_API_KEY || '',
    timeoutMs: parseInt(process.env.MODEL_API_TIMEOUT_MS || '15000', 10),
    useMock: process.env.USE_MOCK_MODELS === 'true' || !process.env.MODEL_API_BASE_URL
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '1000', 10)
  }
};

module.exports = config;
