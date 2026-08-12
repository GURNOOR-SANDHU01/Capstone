/**
 * SentiMed AI Companion Service
 * Mock response generator with CBT principles and wellness guidance.
 * Note: Non-medical, educational/reflection wellness companion only.
 */

const MOCK_AI_RESPONSES = [
  "Thank you for sharing that with me. It takes courage to put your thoughts into words. When you notice that feeling, what physical sensations do you experience first?",
  "That sounds like a heavy situation to navigate. If a close friend came to you describing this exact experience, what compassionate advice would you offer them?",
  "I hear you. Let's take a quick breath together: Inhale for 4 seconds, hold for 4, and exhale for 6. How does your posture and chest feel right now?",
  "Reflecting on what you described, notice if there are any binary 'all-or-nothing' assumptions in your mind. Is there a more balanced perspective you can consider?",
  "I'm here to listen. Taking a moment to log how you feel is an empowering step toward emotional awareness."
];

export const generateCompanionReply = async (userMessage) => {
  // Simulate natural assistant thinking delay
  await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 600));

  const lower = userMessage.toLowerCase();
  
  if (lower.includes("stressed") || lower.includes("anxious") || lower.includes("tight")) {
    return "I notice you mentioned feeling stressed or anxious. Try grounding yourself using the 5-4-3-2-1 technique: Name 5 things you can see around you right now, 4 things you can physically touch, 3 things you hear, 2 things you smell, and 1 slow breath.";
  }
  
  if (lower.includes("pattern") || lower.includes("reflect")) {
    return "Looking at your recent reflections, your mood tends to elevate after spending time outdoors or connecting with friends. Building short 15-minute breaks into your day might help sustain that stability.";
  }

  if (lower.includes("exercise") || lower.includes("mindfulness")) {
    return "Here is a simple 2-minute box breathing exercise:\n1. Inhale deeply through your nose for 4 seconds.\n2. Hold your breath gently for 4 seconds.\n3. Exhale smoothly through your mouth for 4 seconds.\n4. Rest for 4 seconds.\nRepeat this 3 times.";
  }

  // Fallback response from pool
  const randomIndex = Math.floor(Math.random() * MOCK_AI_RESPONSES.length);
  return MOCK_AI_RESPONSES[randomIndex];
};
