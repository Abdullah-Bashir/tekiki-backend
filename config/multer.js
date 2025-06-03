// config/multer.js
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from './cloudinary.js';

// (1) List of “official” MIME-types we want to accept
const DOCUMENT_MIMETYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // sometimes browsers send slightly different strings—let’s also accept these:
  'application/vnd.ms-word.document.macroenabled.12',
  'application/octet-stream', // fallback in case something lands as octet-stream
];

const MEDIA_MIMETYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
];

function isValidMedia(mimetype) {
  return MEDIA_MIMETYPES.includes(mimetype);
}

function isValidDocument(mimetype) {
  return DOCUMENT_MIMETYPES.includes(mimetype);
}

// Cloudinary storage config stays exactly the same
const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    const baseParams = {
      folder: `services/${file.fieldname}`,
      resource_type: 'auto',
    };

    if (file.fieldname === 'media') {
      return {
        ...baseParams,
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'webm'],
        transformation: { quality: 'auto:good' },
      };
    }

    if (file.fieldname === 'documents') {
      return {
        ...baseParams,
        resource_type: 'raw',
        allowed_formats: ['pdf', 'doc', 'docx'],
      };
    }

    // coverImage
    return {
      ...baseParams,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation: { width: 1200, crop: 'limit', quality: 'auto:best' },
    };
  },
});

const fileFilter = (req, file, cb) => {
  // Log the MIME‐type so we can see exactly what’s coming in for DOCX
  console.log(`→ [fileFilter] ${file.fieldname} ● ${file.originalname} ● mimetype: ${file.mimetype}`);

  if (file.fieldname === 'media') {
    if (!isValidMedia(file.mimetype)) {
      return cb(
        new Error('Only images (JPEG, PNG, GIF, WEBP) and videos (MP4, MOV, WEBM) allowed for media'),
        false
      );
    }
    return cb(null, true);
  }

  if (file.fieldname === 'documents') {
    if (!isValidDocument(file.mimetype)) {
      return cb(
        new Error(
          `Only PDF, DOC, and DOCX allowed for documents (got: ${file.mimetype})`
        ),
        false
      );
    }
    return cb(null, true);
  }

  if (file.fieldname === 'coverImage') {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only images allowed for cover image'), false);
    }
    return cb(null, true);
  }

  // If we somehow get here, accept
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
    files: 16, // max 1 cover + 10 media + 5 docs
  },
});

export default upload;
