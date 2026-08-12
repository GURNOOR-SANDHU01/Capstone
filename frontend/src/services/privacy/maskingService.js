import { PII_PATTERNS } from "./piiDetector";

/**
 * SentiMed Masking Service
 * Reusable client-side transformation engine that redacts sensitive PII patterns.
 */

export const maskPiiText = (input = "") => {
  if (!input || typeof input !== "string") return "";

  let masked = input;

  // Redact Emails
  masked = masked.replace(PII_PATTERNS.EMAIL, "[EMAIL REDACTED]");

  // Redact Phone Numbers
  masked = masked.replace(PII_PATTERNS.PHONE, "[PHONE REDACTED]");

  // Redact Physical Addresses
  masked = masked.replace(PII_PATTERNS.ADDRESS, "[ADDRESS REDACTED]");

  // Redact SSN/IDs
  masked = masked.replace(PII_PATTERNS.SSN, "[SSN/ID REDACTED]");

  // Redact DOB
  masked = masked.replace(PII_PATTERNS.DOB, "[DOB REDACTED]");

  return masked;
};
