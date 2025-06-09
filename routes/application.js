import express from "express";
import Application from "../models/Application.js";

const router = express.Router();

// Create new application (POST /applications)
router.post("/", async (req, res) => {
  try {
    const newApplication = new Application(req.body);
    const savedApplication = await newApplication.save();
    res.status(201).json(savedApplication);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


// Get all applications (GET /applications)
router.get("/", async (req, res) => {
  try {
    const applications = await Application.find();
    res.status(200).json(applications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


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
