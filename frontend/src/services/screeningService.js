/**
 * SentiMed Patient Onboarding & Profile Completion Service
 * Manages section-level profile completion states and risk evaluation.
 *
 * Live mode: answers are sent to PUT /api/users/me/onboarding; the backend evaluates risk,
 * stores completion, and raises safety alerts. Sandbox mode keeps the local evaluation below.
 */
import { isRealFirebaseConfigured, toAppUser, auth, saveSandboxUser } from "./firebase";
import { api } from "./apiClient";

export const RISK_LEVELS = {
  LOW: "LOW",
  MODERATE: "MODERATE",
  HIGH_URGENT: "HIGH_URGENT"
};

export const DEFAULT_COMPLETION_STATE = {
  profileCompleted: false,
  sections: {
    basicInfo: false,
    emergencyContact: false,
    wellnessScreening: false,
    safetyScreening: false,
    privacyConsent: false
  }
};

/**
 * Evaluates whether a user profile has completed onboarding based on backend/user object state.
 */
export const getProfileCompletion = (currentUser) => {
  if (!currentUser || currentUser.role !== "patient") {
    return { isComplete: true, sections: DEFAULT_COMPLETION_STATE.sections, firstMissingStep: 1 };
  }

  const profile = currentUser.profile || {};
  const completionState = profile.completionState || {};
  const sections = completionState.sections || {
    // Fallback detection from existing profile fields
    basicInfo: Boolean(profile.name && profile.mobile),
    emergencyContact: Boolean(profile.emergencyContact?.name && profile.emergencyContact?.phone),
    wellnessScreening: Boolean(profile.wellnessAnswers),
    safetyScreening: Boolean(profile.safetyAnswers),
    privacyConsent: Boolean(profile.privacyConsent)
  };

  const isComplete = Boolean(
    completionState.profileCompleted ||
    (sections.basicInfo && sections.emergencyContact && sections.wellnessScreening && sections.safetyScreening && sections.privacyConsent)
  );

  // Determine first missing step (1-indexed)
  let firstMissingStep = 1;
  if (!sections.basicInfo) firstMissingStep = 2;
  else if (!sections.emergencyContact) firstMissingStep = 3;
  else if (!sections.wellnessScreening) firstMissingStep = 4;
  else if (!sections.safetyScreening || !sections.privacyConsent) firstMissingStep = 5;

  return { isComplete, sections, firstMissingStep };
};

/**
 * Classifies clinical risk category from screening answers.
 */
export const evaluateRiskCategory = (wellnessAnswers = {}, safetyAnswers = {}) => {
  if (safetyAnswers.crisisThoughts === "frequent" || safetyAnswers.immediateRisk === "yes") {
    return RISK_LEVELS.HIGH_URGENT;
  }

  if (safetyAnswers.crisisThoughts === "occasional" || wellnessAnswers.sleep === "severe" || wellnessAnswers.anxiety === "severe") {
    return RISK_LEVELS.MODERATE;
  }

  return RISK_LEVELS.LOW;
};

/**
 * Saves screening results and updates user profile completion state.
 */
export const saveScreeningResult = (currentUser, data) => {
  const riskCategory = evaluateRiskCategory(data.wellnessAnswers, data.safetyAnswers);

  const updatedSections = {
    basicInfo: Boolean(data.basicInfo?.fullName && data.basicInfo?.phone),
    emergencyContact: Boolean(data.emergencyContact?.name && data.emergencyContact?.phone),
    wellnessScreening: Boolean(data.wellnessAnswers),
    safetyScreening: Boolean(data.safetyAnswers),
    privacyConsent: true
  };

  const isFullyCompleted = Boolean(
    updatedSections.basicInfo &&
    updatedSections.emergencyContact &&
    updatedSections.wellnessScreening &&
    updatedSections.safetyScreening &&
    updatedSections.privacyConsent
  );

  const newCompletionState = {
    profileCompleted: isFullyCompleted,
    sections: updatedSections,
    updatedAt: new Date().toISOString()
  };

  // Build an updated copy of the sandbox user (the caller's object is not mutated)
  const updatedUser = currentUser
    ? {
        ...currentUser,
        profile: {
          ...(currentUser.profile || {}),
          name: data.basicInfo?.fullName || currentUser.profile?.name,
          mobile: data.basicInfo?.phone || currentUser.profile?.mobile,
          completionState: newCompletionState,
          emergencyContact: data.emergencyContact,
          wellnessAnswers: data.wellnessAnswers,
          safetyAnswers: data.safetyAnswers,
          privacyConsent: true
        }
      }
    : null;
  if (updatedUser) saveSandboxUser(updatedUser);

  return {
    user: updatedUser,
    id: `screen-${Date.now()}`,
    timestamp: new Date().toISOString(),
    riskCategory,
    patientName: data.basicInfo?.fullName || currentUser?.profile?.name || "Patient",
    emergencyContact: data.emergencyContact || {},
    wellnessAnswers: data.wellnessAnswers || {},
    safetyAnswers: data.safetyAnswers || {},
    completionState: newCompletionState
  };
};

/**
 * Submits the onboarding wizard.
 * Returns { riskCategory, user, alertsCreated } where `user` is the refreshed app user.
 */
export const submitOnboarding = async (currentUser, data) => {
  if (!isRealFirebaseConfigured) {
    const record = saveScreeningResult(currentUser, data);
    if (record.riskCategory !== RISK_LEVELS.LOW) {
      // dynamic imports: riskWorkflowService itself imports this module
      const { createRiskAlert } = await import("./riskWorkflowService");
      const { dispatchSafetyNotification } = await import("./notificationService");
      createRiskAlert(record);
      await dispatchSafetyNotification({
        recipientType: "DOCTOR",
        recipientName: "Care Team",
        riskCategory: record.riskCategory,
        alertType: record.riskCategory === RISK_LEVELS.HIGH_URGENT ? "URGENT_SAFETY_SCREENING" : "MODERATE_WELLNESS_FLAG"
      });
    }
    return { ...record, alertsCreated: record.riskCategory === RISK_LEVELS.LOW ? 0 : 1 };
  }

  const { data: result } = await api.put("/users/me/onboarding", {
    basic_info: {
      full_name: data.basicInfo.fullName,
      phone: data.basicInfo.phone,
      language: data.basicInfo.language || "English"
    },
    emergency_contact: {
      name: data.emergencyContact.name,
      relation: data.emergencyContact.relation,
      phone: data.emergencyContact.phone
    },
    wellness_answers: data.wellnessAnswers,
    safety_answers: {
      crisis_thoughts: data.safetyAnswers.crisisThoughts,
      immediate_risk: data.safetyAnswers.immediateRisk || "no"
    },
    privacy_consent: true
  });

  return {
    riskCategory: result.risk_category,
    alertsCreated: result.alerts_created,
    user: toAppUser(auth?.currentUser, result.profile)
  };
};
