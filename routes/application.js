import express from "express";
import Application from "../models/applications.js";
import User from "../models/user.js";
import upload from "../config/multer.js"; // your multer configuration
import { extractPublicId, extractVersion } from "../utils/cloudinaryUtils.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// Helper function to create download URLs
function makeRawDownloadUrl(cloudinaryUrl, originalName) {

  const publicId = extractPublicId(cloudinaryUrl);
  const version = extractVersion(cloudinaryUrl);
  if (!publicId || !version) return cloudinaryUrl;

  const safeName = encodeURIComponent(originalName).replace(/\./g, "%2E");
  return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLIENT_NAME}/raw/upload/fl_attachment:${safeName}/v${version}/${publicId}`;
}

// POST /applications with improved error handling

router.post(
  "/",
  authMiddleware,
  async (req, res, next) => {
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      upload.single("cv")(req, res, (err) => {
        if (err) {
          console.error("File upload error:", err);
          return res.status(400).json({ error: err.message });
        }
        req.uploadedFile = req.file;
        next();
      });
    } else {
      next();
    }
  },
  async (req, res) => {
    try {
      console.log("Received application data:", req.body); // Log incoming data
      
      const body = req.body;
      let cvData = null;

      if (req.uploadedFile) {
        cvData = {
          url: req.uploadedFile.path,
          originalName: req.uploadedFile.originalname,
          resource_type: req.uploadedFile.resource_type || "raw",
        };
      } else if (body.existingCv) {
        try {
          cvData = JSON.parse(body.existingCv);
          const user = await User.findById(req.user._id);
          if (!user.cv || user.cv.url !== cvData.url) {
            return res.status(400).json({ error: "Invalid CV reference" });
          }
        } catch (parseError) {
          console.error("Error parsing existing CV:", parseError);
          return res.status(400).json({ error: "Invalid CV data" });
        }
      }

      let interviewDate;
      try {
        interviewDate = JSON.parse(body.interviewDate);
      } catch (e) {
        console.error("Error parsing interview date:", e);
        return res.status(400).json({ error: "Invalid interview date format" });
      }

      // Validate required fields
      if (!body.name || !body.email) {
        return res.status(400).json({ error: "Name and email are required" });
      }

      const applicationData = {
        name: body.name,
        email: body.email,
        serviceId: body.serviceId,
        userId: req.user._id,
        interviewDate: interviewDate,
        cv: cvData,
        status: "pending"
      };

      const newApplication = new Application(applicationData);
      const savedApplication = await newApplication.save();
      
      res.status(201).json(savedApplication);
    } catch (error) {
      console.error("Application creation error:", error);
      res.status(400).json({ error: error.message });
    }
  }
);

// Get all applications
router.get("/", async (req, res) => {
  try {
    const applications = await Application.find()
      .populate("serviceId", "serviceName")
      .lean();

    const serializedApplications = applications.map((app) => ({
      ...app,
      _id: app._id.toString(),
      serviceId: app.serviceId
        ? {
            _id: app.serviceId._id.toString(),
            name: app.serviceId.serviceName,
          }
        : null,
      appliedAt: app.appliedAt.toISOString(),
      interviewDate: app.interviewDate
        ? {
            date: app.interviewDate.date.toISOString(),
            time: app.interviewDate.time,
          }
        : null,
    }));

    res.status(200).json(serializedApplications); // ✅ Only one response
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Get all applications for a specific user (GET /applications/user)
router.get("/user", authMiddleware, async (req, res) => {
  try {
    const userEmail = req.user.email;

    const applications = await Application.find({ email: userEmail })
      .populate("serviceId", "serviceName") // populate only the serviceName field
      .lean();

    const serializedApplications = applications.map((app) => ({
      ...app,
      _id: app._id.toString(),
      serviceId: app.serviceId
        ? {
            _id: app.serviceId._id.toString(),
            name: app.serviceId.serviceName, // use serviceName here
          }
        : null,
      appliedAt: app.appliedAt.toISOString(),
      interviewDate: app.interviewDate
        ? {
            date: app.interviewDate.date.toISOString(),
            time: app.interviewDate.time,
          }
        : null,
    }));

    res.status(200).json(serializedApplications);
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});


// GET /applications/:id with download URL
router.get("/:id", async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Add download URL for CV
    const applicationWithDownload = {
      ...application.toObject(),
      cv: {
        ...application.cv,
        downloadUrl: makeRawDownloadUrl(
          application.cv.url,
          application.cv.originalName
        ),
      },
    };

    res.status(200).json(applicationWithDownload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// PUT /applications/:id for updating applications
router.put(
  "/:id",
  (req, res, next) => {
    upload.single("cv")(req, res, (uploadErr) => {
      if (uploadErr) {
        console.error("Multer/Cloudinary upload error →", uploadErr);
        return res.status(400).json({ error: uploadErr.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const application = await Application.findById(req.params.id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const updateData = {
        ...req.body,
        ...(req.body.interviewDate && {
          interviewDate: JSON.parse(req.body.interviewDate),
        }),
      };

      // Handle CV update
      if (req.file) {
        // Delete old CV if exists
        if (application.cv?.url) {
          const publicId = extractPublicId(application.cv.url);
          if (publicId) {
            await cloudinary.uploader.destroy(publicId, {
              resource_type: application.cv.resource_type || "raw",
            });
          }
        }

        updateData.cv = {
          url: req.file.path,
          originalName: req.file.originalname,
          resource_type: req.file.resource_type || "raw",
        };
      }

      const updatedApplication = await Application.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      );

      // Add download URL in response
      const responseData = {
        ...updatedApplication.toObject(),
        cv: {
          ...updatedApplication.cv,
          downloadUrl: makeRawDownloadUrl(
            updatedApplication.cv.url,
            updatedApplication.cv.originalName
          ),
        },
      };

      res.status(200).json(responseData);
    } catch (error) {
      console.error("Update error:", error);
      res.status(400).json({ error: error.message });
    }
  }
);

// ... (rest of your existing code)
// Delete an application by ID (DELETE /applications/:id)
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Application.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Application not found" });
    }
    res.status(200).json({ message: "Application deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


export default router;
