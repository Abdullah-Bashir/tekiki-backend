import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from './cloudinary.js';

// Valid media mimetypes
const isValidMedia = (mimetype) =>
    ['image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/quicktime', 'video/webm'].includes(mimetype);

// Valid document mimetypes
const isValidDocument = (mimetype) =>
    ['application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(mimetype);

// Cloudinary storage config
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
                transformation: { quality: 'auto:good' }
            };
        }

        if (file.fieldname === 'documents') {
            return {
                ...baseParams,
                resource_type: 'raw',
                allowed_formats: ['pdf', 'doc', 'docx']
            };
        }

        // coverImage
        return {
            ...baseParams,
            allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
            transformation: { width: 1200, crop: 'limit', quality: 'auto:best' }
        };
    }
});

// File filter function
const fileFilter = (req, file, cb) => {
    try {
        if (file.fieldname === 'media' && !isValidMedia(file.mimetype)) {
            return cb(new Error('Only images (JPEG, PNG, GIF, WEBP) and videos (MP4, MOV, WEBM) allowed for media'), false);
        }

        if (file.fieldname === 'documents' && !isValidDocument(file.mimetype)) {
            return cb(new Error('Only PDF, DOC, and DOCX files allowed for documents'), false);
        }

        if (file.fieldname === 'coverImage' && !file.mimetype.startsWith('image/')) {
            return cb(new Error('Only images allowed for cover image'), false);
        }

        cb(null, true);
    } catch (err) {
        cb(err, false);
    }
};

// Export multer instance
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50 MB limit
        files: 16 // max 1 cover + 10 media + 5 docs
    }
});

export default upload;
