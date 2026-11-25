// Tests must not depend on a developer's local .env (e.g. a running model service).
// dotenv never overrides variables that are already set, so these win.
process.env.USE_MOCK_MODELS = 'true';
process.env.MODEL_API_BASE_URL = '';

// Google Fit: fake OAuth client + a fixed test-only encryption key (32 zero bytes, base64)
process.env.GOOGLE_FIT_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
process.env.GOOGLE_FIT_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_FIT_REDIRECT_URI = 'http://localhost:5000/api/google-fit/oauth/callback';
process.env.TOKEN_ENCRYPTION_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
process.env.FRONTEND_URL = 'http://localhost:5173';
