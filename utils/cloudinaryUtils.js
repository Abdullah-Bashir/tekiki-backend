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

  // Handle Cloudinary URL formats:
  // 1. http://res.cloudinary.com/xxx/image/upload/v1234567/folder/file.jpg
  // 2. http://res.cloudinary.com/xxx/raw/upload/v1234567/folder/file.pdf
  const cloudinaryRegex = /cloudinary\.com\/.+\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/;
  const match = fullUrl.match(cloudinaryRegex);

  return match ? match[2] : null; // Returns "folder/file" without extension
}
