const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/;

/**
 * Validate Indian GSTIN format.
 * Rules checked:
 * - Exactly 15 chars
 * - State code (2 digits)
 * - PAN pattern (5 letters + 4 digits + 1 letter)
 * - Entity code (alphanumeric)
 * - 14th char must be Z
 * - Checksum char is alphanumeric
 */
export function validateGstin(gstin: string): { valid: boolean; error?: string } {
  const normalized = (gstin || '').trim().toUpperCase();

  if (!normalized) {
    return { valid: false, error: 'GSTIN is required' };
  }

  if (normalized.length !== 15) {
    return { valid: false, error: 'GSTIN must be exactly 15 characters' };
  }

  if (!GSTIN_REGEX.test(normalized)) {
    return {
      valid: false,
      error: 'Invalid GSTIN format. Example: 27ABCDE1234F1Z5',
    };
  }

  return { valid: true };
}

export function normalizeGstin(gstin: string): string {
  return (gstin || '').trim().toUpperCase();
}
