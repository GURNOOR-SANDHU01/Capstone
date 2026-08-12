/**
 * SentiMed Patient Onboarding & Profile Completion Service
 * Manages section-level profile completion states and risk evaluation.
 */

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

  // Update in-memory user profile
  if (currentUser && currentUser.profile) {
    currentUser.profile.completionState = newCompletionState;
    currentUser.profile.emergencyContact = data.emergencyContact;
    currentUser.profile.wellnessAnswers = data.wellnessAnswers;
    currentUser.profile.safetyAnswers = data.safetyAnswers;
    currentUser.profile.privacyConsent = true;

    try {
      localStorage.setItem("sentimed_current_user", JSON.stringify(currentUser));
    } catch {}
  }

  return {
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
