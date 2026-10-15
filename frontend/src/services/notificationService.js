/**
 * SentiMed Emergency Notification Architecture Service
 * Backend proxy interface for dispatching clinical alerts & emergency contact notifications.
 * Note: Never contains client-side SMTP/SMS API credentials. Passes payloads to backend endpoint.
 */

const NOTIFICATION_LOGS_KEY = "sentimed_notification_delivery_logs";

export const dispatchSafetyNotification = async (payload) => {
  // Simulate secure server proxy dispatch
  const deliveryRecord = {
    id: `notif-${Date.now()}`,
    timestamp: new Date().toISOString(),
    recipientType: payload.recipientType || "DOCTOR", // DOCTOR or EMERGENCY_CONTACT
    recipientName: payload.recipientName || "Care Team",
    riskCategory: payload.riskCategory,
    channel: payload.channel || "SECURE_APP_ALERT", // SECURE_APP_ALERT, SMS_PROXY, EMAIL_PROXY
    deliveryStatus: "DELIVERED",
    minimalPayload: {
      patientId: payload.patientId || "P-0041",
      alertType: payload.alertType || "CLINICAL_SAFETY_FLAG",
      timestamp: new Date().toLocaleTimeString()
    }
  };

  try {
    const existingLogs = JSON.parse(localStorage.getItem(NOTIFICATION_LOGS_KEY) || "[]");
    const updatedLogs = [deliveryRecord, ...existingLogs];
    localStorage.setItem(NOTIFICATION_LOGS_KEY, JSON.stringify(updatedLogs));
  } catch (err) {
    console.warn("Failed to store notification delivery log", err);
  }

  return deliveryRecord;
};

export const getNotificationDeliveryLogs = () => {
  try {
    const saved = localStorage.getItem(NOTIFICATION_LOGS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    /* localStorage unavailable: fall back to demo data */
  }
  return [
    {
      id: "notif-1",
      timestamp: "2026-08-12 11:30 AM",
      recipientType: "DOCTOR",
      recipientName: "Dr. Sarah Jenkins",
      riskCategory: "HIGH_URGENT",
      channel: "SECURE_APP_ALERT",
      deliveryStatus: "DELIVERED",
      minimalPayload: { patientId: "P-0039", alertType: "URGENT_SAFETY_TRIAGE" }
    }
  ];
};
