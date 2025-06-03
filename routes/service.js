import express from "express";
import Service from "../models/service.js";
import upload from "../config/multer.js";
import cloudinary from "../config/cloudinary.js";
import { extractPublicId } from "../utils/cloudinaryUtils.js";

const router = express.Router();


router.put('/:id', upload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'media', maxCount: 10 },
    { name: 'documents', maxCount: 5 }
]), async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) return res.status(404).json({ error: 'Service not found' });

        const assetsToDelete = [];

        // Update text fields
        if (req.body.serviceName) service.serviceName = req.body.serviceName;
        if (req.body.description) service.description = req.body.description;

        // Replace cover image if uploaded
        if (req.files?.coverImage) {
            if (service.coverImage) {
                assetsToDelete.push({
                    url: service.coverImage,
                    resource_type: 'image'
                });
            }
            service.coverImage = req.files.coverImage[0].path;
        }

        // Handle media deletions
        if (req.body.mediaToDelete) {
            const idsToDelete = JSON.parse(req.body.mediaToDelete);
            service.media.forEach(item => {
                if (idsToDelete.includes(item._id.toString())) {
                    assetsToDelete.push({
                        url: item.url,
                        resource_type: item.resource_type || 'image'
                    });
                }
            });
            service.media = service.media.filter(item => !idsToDelete.includes(item._id.toString()));
        }

        // Add new media
        if (req.files?.media) {
            for (const file of req.files.media) {
                service.media.push({
                    url: file.path,
                    resource_type: file.mimetype.startsWith('video') ? 'video' : 'image'
                });
            }
        }

        // Handle document deletions
        if (req.body.docsToDelete) {
            const idsToDelete = JSON.parse(req.body.docsToDelete);
            service.documents.forEach(doc => {
                if (idsToDelete.includes(doc._id.toString())) {
                    assetsToDelete.push({
                        url: doc.url,
                        resource_type: doc.resource_type || 'raw'  // fallback important
                    });
                }
            });
            service.documents = service.documents.filter(item => !idsToDelete.includes(item._id.toString()));
        }

        // Add new documents (ensure resource_type: 'raw' saved)
        if (req.files?.documents) {
            for (const file of req.files.documents) {
                service.documents.push({
                    url: file.path,
                    resource_type: 'raw'  // required for Cloudinary deletion
                });
            }
        }

        // Update interview dates if present
        if (req.body.interviewDates) {
            service.interviewDates = JSON.parse(req.body.interviewDates);
        }

        await service.save();

        // Debug: log saved documents to verify resource_type
        console.log('Saved documents:', service.documents);

        // Delete old assets after saving
        for (const asset of assetsToDelete) {
            try {
                const publicId = extractPublicId(asset.url);
                if (publicId) {
                    console.log('Deleting from Cloudinary:', { publicId, resource_type: asset.resource_type });
                    await cloudinary.uploader.destroy(publicId, {
                        resource_type: asset.resource_type
                    });
                }
            } catch (err) {
                console.error('Error deleting old asset:', err);
            }
        }

        res.json(service);
    } catch (err) {
        console.error('Update error:', err);
        res.status(400).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }

        // Delete cover image from Cloudinary
        if (service.coverImage) {
            const publicId = extractPublicId(service.coverImage);
            if (publicId) {
                await cloudinary.uploader.destroy(publicId);
            }
        }

        // Delete media files from Cloudinary
        for (const item of service.media) {
            const publicId = extractPublicId(item.url);
            if (publicId) {
                await cloudinary.uploader.destroy(publicId, {
                    resource_type: item.resource_type || 'image'
                });
            }
        }

        // Delete documents from Cloudinary
        for (const doc of service.documents) {
            const publicId = extractPublicId(doc.url);
            if (publicId) {
                await cloudinary.uploader.destroy(publicId, {
                    resource_type: 'raw'
                });
            }
        }

        // Now delete the service from database
        await Service.findByIdAndDelete(req.params.id);

        res.json({ message: 'Service deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/', upload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'media', maxCount: 10 },
    { name: 'documents', maxCount: 5 },
]),
    async (req, res) => {
        try {
            const { serviceName, description, interviewDates } = req.body;

            // Validate required fields
            if (!serviceName?.trim() || !description?.trim() || !interviewDates) {
                return res.status(400).json({
                    message: 'Service name, description, and interview dates are required',
                });
            }

            // Validate files exist
            if (!req.files?.coverImage?.[0]) {
                return res.status(400).json({ message: 'Cover image is required' });
            }

            // Parse and validate interview dates
            let parsedDates;

            try {
                parsedDates = JSON.parse(interviewDates);
                if (!Array.isArray(parsedDates)) {
                    return res.status(400).json({ message: 'Interview dates must be an array' });
                }

                // Convert date strings to Date objects and validate
                parsedDates = parsedDates.map(dateObj => {
                    if (!dateObj.date || !dateObj.time) {
                        throw new Error('All interview dates must have both date and time');
                    }

                    const date = new Date(dateObj.date);
                    if (isNaN(date.getTime())) {
                        throw new Error('Invalid date format');
                    }

                    return {
                        date: date, // Store as Date object
                        time: dateObj.time
                    };
                });

            } catch (err) {
                return res.status(400).json({ message: err.message || 'Invalid interview dates format' });
            }

            // Get files from req.files (already processed by multer)
            const { coverImage, media, documents } = req.files;

            // Create service with Cloudinary URLs
            const service = new Service({
                serviceName,
                description,
                coverImage: coverImage[0].path, // Cloudinary URL is in file.path
                media: media?.map(file => ({
                    url: file.path,
                    resource_type: file.mimetype.startsWith('video') ? 'video' : 'image'
                })) || [],
                documents: documents?.map(file => ({
                    url: file.path
                })) || [],
                interviewDates: parsedDates
            });

            await service.save();

            return res.status(201).json(service);

        } catch (error) {
            console.error('Service creation error:', error);
            return res.status(500).json({
                message: error.message || 'Failed to create service',
            });
        }
    }
);

router.get('/', async (req, res) => {
    try {
        const services = await Service.find();
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add this route before the export default router
router.get('/:id', async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }
        res.json(service);
    } catch (error) {
        console.error('Error fetching service:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;