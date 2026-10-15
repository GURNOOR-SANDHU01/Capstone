const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const config = require('./config/env');
const logger = require('./utils/logger');
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const { error } = require('./utils/apiResponse');

// Import routes
const healthRoutes = require('./routes/health.routes');
const userRoutes = require('./routes/users.routes');
const journalRoutes = require('./routes/journal.routes');
const analysisRoutes = require('./routes/analysis.routes');
const memoryRoutes = require('./routes/memories.routes');
const reflectionRoutes = require('./routes/reflections.routes');
const consentRoutes = require('./routes/consent.routes');
const safetyRoutes = require('./routes/safety.routes');
const biometricRoutes = require('./routes/biometrics.routes');
const patientRoutes = require('./routes/patients.routes');
const doctorRoutes = require('./routes/doctors.routes');
const adminRoutes = require('./routes/admin.routes');
const careRoutes = require('./routes/care.routes');

const app = express();

// Security HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: false // Allow inline scripts for local demo/frontend
  })
);

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      // In development, allow localhost on any port
      if (config.env === 'development') {
        return callback(null, true);
      }
      if (config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS Not Allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Body parsing with payload size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Static frontend assets
app.use(express.static(path.resolve(__dirname, '../public')));

// Request logging (PII safe)
app.use((req, res, next) => {
  logger.info(`--> ${req.method} ${req.originalUrl}`);
  next();
});

// Apply rate limiting to all /api routes
app.use('/api', apiLimiter);

// Mount API routes
app.use('/api/health', healthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/journal-entries', journalRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/memories', memoryRoutes);
app.use('/api/reflection-prompts', reflectionRoutes);
app.use('/api/consent', consentRoutes);
app.use('/api/safety-alerts', safetyRoutes);
app.use('/api/biometrics', biometricRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', careRoutes);

// Catch-all for undefined API routes
app.all('/api/*', (req, res) => {
  return error(res, 'ENDPOINT_NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`, 404);
});

// Global error handler
app.use(errorHandler);

module.exports = app;
