// config/multer.js
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from './cloudinary.js';

// 1) All acceptable MIME-types for documents:
const DOCUMENT_MIMETYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-word.document.macroenabled.12',
  'application/octet-stream',
  // If your browser ever logs `application/zip` for a docx, add it here:
  'application/zip'
];

// 2) All acceptable MIME-types for media:
const MEDIA_MIMETYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm'
];

function isValidMedia(mimetype) {
  return MEDIA_MIMETYPES.includes(mimetype);
}
function isValidDocument(mimetype) {
  return DOCUMENT_MIMETYPES.includes(mimetype);
}

const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    console.log(
      '→ [CloudinaryStorage.params] fieldname:',
      file.fieldname,
      'originalname:',
      file.originalname,
      'mimetype:',
      file.mimetype
    );

    if (file.fieldname === 'documents') {
      return {
        folder: 'services/documents',
        resource_type: 'raw',
        // allowed_formats: ['pdf', 'doc', 'docx']
      };
    }

    if (file.fieldname === 'media') {
      return {
        folder: 'services/media',
        resource_type: 'auto',
        allowed_formats: ['jpg','jpeg','png','gif','webp','mp4','mov','webm']
      };
    }

    // coverImage
    return {
      folder: 'services/coverImage',
      resource_type: 'image',
      allowed_formats: ['jpg','jpeg','png','gif','webp'],
      transformation: { width: 1200, crop: 'limit', quality: 'auto:best' }
    };
  }
});

const fileFilter = (req, file, cb) => {
  console.log(
    '→ [fileFilter] fieldname:',
    file.fieldname,
    'originalname:',
    file.originalname,
    'mimetype:',
    file.mimetype
  );

  if (file.fieldname === 'documents') {
    if (!isValidDocument(file.mimetype)) {
      return cb(
        new Error(`Only PDF, DOC, DOCX allowed (got: ${file.mimetype})`),
        false
      );
    }
    return cb(null, true);
  }

  if (file.fieldname === 'media') {
    if (!isValidMedia(file.mimetype)) {
      return cb(
        new Error(
          `Only images (JPEG, PNG, GIF, WEBP) and videos (MP4, MOV, WEBM) allowed for media (got: ${file.mimetype})`
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

  // If for some reason you have a different field, just accept it:
  return cb(null, true);
};

export default multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
    files: 16                  // (1 cover + 10 media + 5 docs)
  }
});
