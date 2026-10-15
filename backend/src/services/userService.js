const userRepository = require('../repositories/userRepository');
const safetyService = require('./safetyService');
const { Timestamp } = require('../config/firebase/firestore');
const { httpError } = require('./accessPolicy');
const logger = require('../utils/logger');

const RISK_LEVELS = Object.freeze({ LOW: 'LOW', MODERATE: 'MODERATE', HIGH_URGENT: 'HIGH_URGENT' });

/**
 * Server-side risk classification of onboarding answers (same thresholds the
 * frontend wizard used to apply locally).
 */
function evaluateRiskCategory(wellness = {}, safety = {}) {
  if (safety.crisis_thoughts === 'frequent' || safety.immediate_risk === 'yes') return RISK_LEVELS.HIGH_URGENT;
  if (safety.crisis_thoughts === 'occasional' || wellness.sleep === 'severe' || wellness.anxiety === 'severe') {
    return RISK_LEVELS.MODERATE;
  }
  return RISK_LEVELS.LOW;
}

/**
 * The profile returned to clients. `role` always comes from the verified token claim,
 * never from the stored document.
 */
function toClientProfile(profile, user) {
  return { ...profile, role: user.role };
}

class UserService {
  async getProfile(user) {
    let profile = await userRepository.getById(user.uid);
    if (!profile) {
      // First sign-in: initialize a profile with server-controlled defaults only
      const displayName = user.claims?.name || (user.email ? user.email.split('@')[0] : 'Sentience User');
      profile = await userRepository.create(user.uid, {
        email: user.email || '',
        full_name: displayName,
        role: user.role
      });
      logger.info(`Initialized new user profile for UID: ${user.uid}`);
    }
    return toClientProfile(profile, user);
  }

  async updateProfile(user, data) {
    await this.getProfile(user); // ensure the profile exists
    const updated = await userRepository.update(user.uid, data);
    if (!updated) throw httpError(404, 'USER_NOT_FOUND', 'User profile not found');
    return toClientProfile(updated, user);
  }

  async completeOnboarding(user, data) {
    await this.getProfile(user);
    const now = Timestamp.now();
    const riskCategory = evaluateRiskCategory(data.wellness_answers, data.safety_answers);

    const updated = await userRepository.setFields(user.uid, {
      full_name: data.basic_info.full_name,
      phone: data.basic_info.phone,
      language: data.basic_info.language,
      emergency_contact: data.emergency_contact,
      onboarding: {
        completed: true,
        completed_at: now,
        sections: {
          basic_info: true,
          emergency_contact: true,
          wellness_screening: true,
          safety_screening: true,
          privacy_consent: true
        },
        privacy_consent: true,
        privacy_consent_at: now,
        risk_category: riskCategory,
        screening: {
          wellness: data.wellness_answers,
          safety: data.safety_answers
        }
      }
    });

    let alerts = [];
    if (riskCategory !== RISK_LEVELS.LOW) {
      try {
        alerts = await safetyService.raiseAlert(user.uid, {
          severity: riskCategory === RISK_LEVELS.HIGH_URGENT ? 'critical' : 'moderate',
          alertType: 'onboarding_safety_screening',
          reason:
            riskCategory === RISK_LEVELS.HIGH_URGENT
              ? 'Onboarding safety screening responses triggered the urgent review protocol.'
              : 'Onboarding screening reported moderate anxiety or sleep disruption.'
        });
      } catch (err) {
        logger.error('Failed to raise onboarding safety alert', { error: err.message });
      }
    }

    return {
      profile: toClientProfile(updated, user),
      risk_category: riskCategory,
      alerts_created: alerts.length
    };
  }

  async deleteAccount(uid, confirmation) {
    if (!confirmation?.confirm) {
      throw httpError(400, 'CONFIRMATION_REQUIRED', 'Explicit confirmation is required to delete account.');
    }
    return userRepository.deleteAccount(uid);
  }
}

module.exports = new UserService();
module.exports.evaluateRiskCategory = evaluateRiskCategory;
module.exports.RISK_LEVELS = RISK_LEVELS;
