/**
 * Secure Doctor-Patient Messaging Service
 */

const MESSAGES_KEY = "sentimed_doctor_patient_messages";

export const INITIAL_MESSAGES = [
  {
    id: "msg-101",
    senderRole: "doctor",
    senderName: "Dr. Sarah Jenkins",
    text: "Hello Gurnoor. I noticed your morning sentiment scores have improved following your daily walks. How are your sleep patterns holding up?",
    time: "Yesterday, 4:15 PM"
  },
  {
    id: "msg-102",
    senderRole: "patient",
    senderName: "Gurnoor Sandhu",
    text: "Thanks Dr. Jenkins. Sleeping has been much better this week, around 7 hours a night. The breathing exercise helped.",
    time: "Yesterday, 5:02 PM"
  }
];

export const getMessages = () => {
  try {
    const saved = localStorage.getItem(MESSAGES_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return INITIAL_MESSAGES;
};

export const sendMessage = (senderRole, senderName, text) => {
  const current = getMessages();
  const created = {
    id: `msg-${Date.now()}`,
    senderRole,
    senderName,
    text,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  const updated = [...current, created];
  try {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
};
