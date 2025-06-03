// routes/service.js
import express from 'express';
import Service from '../models/service.js';
import upload from '../config/multer.js';
import cloudinary from '../config/cloudinary.js';
import { extractPublicId, extractVersion } from '../utils/cloudinaryUtils.js';
import axios from 'axios';
import path from 'path';

const router = express.Router();

/**
 * Helper: Given a Cloudinary‐stored URL and the original filename,
 * build a “download” URL with fl_attachment so that the browser uses
 * the correct filename.
 */
function makeRawDownloadUrl(cloudinaryUrl, originalName) {
  const publicId = extractPublicId(cloudinaryUrl);
  const version  = extractVersion(cloudinaryUrl);
  if (!publicId || !version) return cloudinaryUrl;

  // 1) First URL-encode spaces, etc.
  // 2) Then replace "." with "%2E" so Cloudinary sees the entire filename as one token.
  const safeName = encodeURIComponent(originalName).replace(/\./g, '%2E');

  // Construct the "raw/upload/fl_attachment:<filename>" URL by hand:
  const base = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLIENT_NAME}`;
  const path = `/raw/upload/fl_attachment:${safeName}/v${version}/${publicId}`;
  const url  = `${base}${path}`;

  console.log('⚡ downloadUrl built:', url);
  return url;
}

/**
 * POST /        ← Create a new service
 * Fields: serviceName (string), description (string), interviewDates (JSON-stringified array of {date, time})
 * Files (multipart-form): coverImage (1), media (up to 10), documents (up to 5)
 */
// Instead of router.post('/', upload.fields([...]), async (req,res) => { … }),
// do it in two steps so we can catch any Multer error first:

router.post(
  '/',
  (req, res, next) => {
    upload.fields([
      { name: 'coverImage', maxCount: 1 },
      { name: 'media',     maxCount: 10 },
      { name: 'documents', maxCount: 5 }
    ])(req, res, (uploadErr) => {
      if (uploadErr) {
        // This is where Multer (or Cloudinary) will throw its error if it
        // rejects the .docx. By logging uploadErr, you’ll see exactly why.
        console.error('Multer/Cloudinary upload error →', uploadErr);
        return res.status(400).json({ error: uploadErr.message });
      }
      // No error from Multer, so move on to your async handler:
      next();
    });
  },
  async (req, res) => {
    console.log('in here…'); // now we know Multer succeeded
    try {
      // …all your validation, Service.save(), etc.…
      const { serviceName, description, interviewDates } = req.body;
      if (!serviceName?.trim() || !description?.trim() || !interviewDates) {
        return res.status(400).json({
          message: 'serviceName, description, and interviewDates are all required'
        });
      }
      if (!req.files?.coverImage?.[0]) {
        return res.status(400).json({ message: 'Cover image is required.' });
      }

      // Parse interviewDates…
      let parsedDates;
      try {
        parsedDates = JSON.parse(interviewDates);
        if (!Array.isArray(parsedDates)) throw new Error('interviewDates must be an array');
        parsedDates = parsedDates.map((d) => {
          if (!d.date || !d.time) {
            throw new Error('Each interview date needs both date and time');
          }
          const dateObj = new Date(d.date);
          if (isNaN(dateObj.getTime())) {
            throw new Error('Invalid date format in interviewDates');
          }
          return { date: dateObj, time: d.time };
        });
      } catch (err) {
        return res.status(400).json({ message: err.message || 'Invalid interviewDates format' });
      }

      // Build media/docs arrays exactly as before…
      const coverImageFile = req.files.coverImage[0];
      const mediaFiles = req.files.media || [];
      const documentFiles = req.files.documents || [];

      const mediaArray = mediaFiles.map((f) => ({
        url: f.path,
        resource_type: f.mimetype.startsWith('video') ? 'video' : 'image'
      }));

      const documentsArray = documentFiles.map((f) => ({
        url: f.path,
        resource_type: 'raw',
        originalName: f.originalname
      }));

      const newService = new Service({
        serviceName,
        description,
        coverImage: coverImageFile.path,
        media: mediaArray,
        documents: documentsArray,
        interviewDates: parsedDates
      });
      await newService.save();
      return res.status(201).json(newService);
    } catch (err) {
      console.error('Upload/Create error →', err);
      return res.status(500).json({ error: err.message });
    }
  }
);

router.get('/:serviceId/download/:docId', async (req, res) => {
  try {
    const { serviceId, docId } = req.params;
    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).send('Service not found');

    // Find the document sub‐record by its ObjectId
    const doc = service.documents.id(docId);
    if (!doc) return res.status(404).send('Document not found');

    const fileUrl      = doc.url;            // e.g. "https://res.cloudinary.com/.../raw/upload/v17489.../services/documents/abc123"
    const originalName = doc.originalName;   // e.g. "1.pdf"

    // 1) Ask Cloudinary for the raw file as a stream
    const cloudinaryResponse = await axios.get(fileUrl, {
      responseType: 'stream'
    });

    // 2) Copy Cloudinary’s Content-Type (e.g. application/pdf)
    const contentType = cloudinaryResponse.headers['content-type'] || 'application/octet-stream';

    // 3) Set our own headers so the browser saves as the original filename:
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${path.basename(originalName)}"`
    );

    // 4) Pipe the Cloudinary stream directly into our response
    cloudinaryResponse.data.pipe(res);
  } catch (err) {
    console.error('Download proxy error:', err);
    return res.status(500).send('Failed to download document');
  }
});


/**
 * GET /        ← List all services
 */
router.get('/', async (req, res) => {
  try {
    const services = await Service.find();
    return res.json(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    return res.status(500).json({ error: error.message });
  }
});


/**
 * GET /:id     ← Fetch a single service by ID, with downloadUrl for each document
 */
router.get('/:id', async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const docsWithDownload = service.documents.map((doc) => ({
      _id:          doc._id,
      url:          doc.url,
      resource_type:doc.resource_type,
      originalName: doc.originalName,
      downloadUrl:  makeRawDownloadUrl(doc.url, doc.originalName)
    }));

    const mediaWithNoChange = service.media.map((m) => ({
      _id:          m._id,
      url:          m.url,
      resource_type:m.resource_type
    }));

    return res.json({
      _id:          service._id,
      serviceName:  service.serviceName,
      description:  service.description,
      coverImage:   service.coverImage,
      media:        mediaWithNoChange,
      documents:    docsWithDownload,
      interviewDates: service.interviewDates
    });
  } catch (error) {
    console.error('Error fetching service by ID:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /:id     ← Update an existing service
 *   - You can replace text fields, replace coverImage, delete old media/docs, add new media/docs, update interviewDates.
 */
router.put(
  '/:id',
  upload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'media', maxCount: 10 },
    { name: 'documents', maxCount: 5 }
  ]),
  async (req, res) => {
    try {
      const service = await Service.findById(req.params.id);
      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      const assetsToDelete = [];

      // 1) Update text fields if provided
      if (req.body.serviceName) service.serviceName = req.body.serviceName;
      if (req.body.description) service.description = req.body.description;

      // 2) Replace coverImage if a new file was uploaded
      if (req.files?.coverImage) {
        // schedule deletion of old coverImage from Cloudinary
        if (service.coverImage) {
          assetsToDelete.push({
            url: service.coverImage,
            resource_type: 'image'
          });
        }
        service.coverImage = req.files.coverImage[0].path;
      }

      // 3) Handle media deletions (if any IDs passed in req.body.mediaToDelete)
      if (req.body.mediaToDelete) {
        const idsToDelete = JSON.parse(req.body.mediaToDelete);
        service.media.forEach((item) => {
          if (idsToDelete.includes(item._id.toString())) {
            assetsToDelete.push({
              url: item.url,
              resource_type: item.resource_type || 'image'
            });
          }
        });
        service.media = service.media.filter(
          (item) => !idsToDelete.includes(item._id.toString())
        );
      }

      // 4) Add new media files (if any)
      if (req.files?.media) {
        for (const file of req.files.media) {
          service.media.push({
            url: file.path,
            resource_type: file.mimetype.startsWith('video') ? 'video' : 'image'
          });
        }
      }

      // 5) Handle document deletions (if any IDs passed in req.body.docsToDelete)
      if (req.body.docsToDelete) {
        const idsToDelete = JSON.parse(req.body.docsToDelete);
        service.documents.forEach((doc) => {
          if (idsToDelete.includes(doc._id.toString())) {
            assetsToDelete.push({
              url: doc.url,
              resource_type: doc.resource_type || 'raw'
            });
          }
        });
        service.documents = service.documents.filter(
          (doc) => !idsToDelete.includes(doc._id.toString())
        );
      }

      // 6) Add new documents
      if (req.files?.documents) {
        for (const file of req.files.documents) {
          service.documents.push({
            url: file.path,
            resource_type: 'raw',
            originalName: file.originalname
          });
        }
      }

      // 7) Update interviewDates if provided
      if (req.body.interviewDates) {
        try {
          const parsedDates = JSON.parse(req.body.interviewDates);
          service.interviewDates = parsedDates.map((d) => ({
            date: new Date(d.date),
            time: d.time
          }));
        } catch (err) {
          return res
            .status(400)
            .json({ message: 'Invalid format for interviewDates' });
        }
      }

      // 8) Save the updated service
      await service.save();

      // 9) Delete old Cloudinary assets (coverImage / media / docs)
      for (const asset of assetsToDelete) {
        try {
          const publicId = extractPublicId(asset.url);
          if (publicId) {
            await cloudinary.uploader.destroy(publicId, {
              resource_type: asset.resource_type
            });
          }
        } catch (err) {
          console.error('Error deleting old Cloudinary asset:', err);
        }
      }

      // 10) Return the freshly updated service (you can refetch if you want the downloadUrl in docs)
      const updated = await Service.findById(req.params.id);
      const docsWithDownload = updated.documents.map((doc) => ({
        _id: doc._id,
        url: doc.url,
        resource_type: doc.resource_type,
        originalName: doc.originalName,
        downloadUrl: makeRawDownloadUrl(doc.url, doc.originalName)
      }));

      return res.json({
        _id: updated._id,
        serviceName: updated.serviceName,
        description: updated.description,
        coverImage: updated.coverImage,
        media: updated.media,
        documents: docsWithDownload,
        interviewDates: updated.interviewDates
      });
    } catch (err) {
      console.error('Update error:', err);
      return res.status(400).json({ error: err.message });
    }
  }
);


/**
 * DELETE /:id  ← Remove a service and clean up all Cloudinary assets
 */
router.delete('/:id', async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // 1) Delete coverImage from Cloudinary
    if (service.coverImage) {
      const publicId = extractPublicId(service.coverImage);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
      }
    }

    // 2) Delete each media item
    for (const item of service.media) {
      const publicId = extractPublicId(item.url);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId, {
          resource_type: item.resource_type || 'image'
        });
      }
    }

    // 3) Delete each document (resource_type: 'raw')
    for (const doc of service.documents) {
      const publicId = extractPublicId(doc.url);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId, {
          resource_type: 'raw'
        });
      }
    }

    // 4) Remove the service from Mongo
    await Service.findByIdAndDelete(req.params.id);
    return res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
