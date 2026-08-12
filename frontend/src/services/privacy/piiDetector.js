/**
 * SentiMed PII Detection Engine
 * Regular expression heuristics for identifying phone numbers, emails, physical addresses,
 * government IDs, and birthdates.
 */

export const PII_PATTERNS = {
  PHONE: /(\+?\d{1,4}?[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  ADDRESS: /\b\d{1,5}\s+(?:[A-Za-z0-9#.]+\s+){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way)\b/gi,
  SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
  DOB: /\b(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/g
};

export const detectPii = (text = "") => {
  if (!text || typeof text !== "string") return [];

  const detections = [];

  Object.entries(PII_PATTERNS).forEach(([category, pattern]) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach((match) => {
        detections.push({ category, value: match });
      });
    }
  });

  return detections;
};
