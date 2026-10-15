const { success } = require('../utils/apiResponse');
const { db } = require('../config/firebase/firestore');
const config = require('../config/env');
const modelService = require('../services/modelService');

async function getHealth(req, res) {
  return success(res, {
    status: 'ok',
    service: 'sentience-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
}

async function getFirebaseHealth(req, res) {
  let firestoreConnected = false;
  let statusMessage = 'connected';

  try {
    // 2.5s timeout protection for environments without live Google Cloud network/credentials
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection check timeout')), 2500)
    );
    await Promise.race([
      db.collection('_health_check').limit(1).get(),
      timeoutPromise
    ]);
    firestoreConnected = true;
  } catch (err) {
    firestoreConnected = false;
    statusMessage = err.message.includes('timeout')
      ? 'Awaiting credentials or emulator connection'
      : err.message;
  }

  return success(res, {
    status: firestoreConnected ? 'healthy' : 'degraded',
    firebase: {
      projectId: config.firebase.projectId,
      databaseLocation: config.firebase.databaseLocation,
      firestoreConnected,
      info: statusMessage
    }
  });
}

async function getModelHealth(req, res) {
  const modelStatus = await modelService.healthCheck();
  return success(res, modelStatus);
}

module.exports = {
  getHealth,
  getFirebaseHealth,
  getModelHealth
};
