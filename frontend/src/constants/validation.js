/**
 * Validation Constants
 * File validation and upload constraints
 */

// File Size Limits
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
export const MAX_FILE_SIZE_MB = 50;

// Allowed File Extensions
export const ALLOWED_EXTENSIONS = ['.trees', '.tsz', '.csv'];

// Validation Messages
export const VALIDATION_MESSAGES = {
  FILE_TOO_LARGE: (maxSize) => `File exceeds ${maxSize}MB limit.`,
  INVALID_FILE_TYPE: (allowed) => `Invalid file type. Allowed: ${allowed.join(', ')}`,
  NO_FILE_SELECTED: 'Please select a file to upload.',
};
