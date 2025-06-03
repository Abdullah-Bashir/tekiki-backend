// utils/cloudinaryUtils.js

/**
 * Given a full Cloudinary URL like:
 *   https://res.cloudinary.com/<cloud>/raw/upload/v1234567890/services/documents/abc123
 * 
 * extractVersion returns "1234567890" (the digits after "v").
 */
export function extractVersion(fullUrl) {
  if (!fullUrl) return null;
  const match = fullUrl.match(/\/upload\/v(\d+)\//);
  return match ? match[1] : null;
}

/**
 * Given the same full URL:
 *   https://res.cloudinary.com/<cloud>/raw/upload/v1234567890/services/documents/abc123
 * 
 * extractPublicId returns "services/documents/abc123".
 */
export function extractPublicId(fullUrl) {
  if (!fullUrl) return null;
  const parts = fullUrl.split('/upload/');
  if (parts.length < 2) return null;
  // parts[1] === "v1234567890/services/documents/abc123"
  // Strip off the "v<digits>/" prefix:
  const afterVersion = parts[1].replace(/^v\d+\//, '');
  return afterVersion; // → "services/documents/abc123"
}
