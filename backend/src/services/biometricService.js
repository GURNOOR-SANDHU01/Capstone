const biometricRepository = require('../repositories/biometricRepository');

class BiometricService {
  async syncBiometrics(userId, data) {
    const metricsCount = data.metrics ? Object.keys(data.metrics).length : 0;
    const syncResult = await biometricRepository.createSyncLog(userId, {
      provider: data.provider,
      status: 'success',
      data_synced: {
        metrics_count: metricsCount,
        date_range: data.date_range || 'last 24 hours'
      }
    });

    return {
      sync: syncResult,
      metrics: data.metrics || {}
    };
  }

  async listLogs(userId, query) {
    return biometricRepository.listLogsForUser(userId, query);
  }
}

module.exports = new BiometricService();
