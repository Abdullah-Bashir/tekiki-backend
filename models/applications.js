import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  email: {
    type: String,
    required: true,
    trim: true,
  },

  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
    required: true,
  },

  interviewDate: {
    date: { type: Date, required: true },
    time: { type: String, required: true }, // e.g., "10:30 AM"
  },

  cv: {
    url: { type: String, required: true },
    resource_type: { type: String, default: "raw" },
    originalName: { type: String, required: true },
  },

  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },

  appliedAt: {
    type: Date,
    default: Date.now,
  },
  
});

const Application = mongoose.model("Application", applicationSchema);
export default Application;
