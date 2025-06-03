import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
  url:          { type: String, required: true },
  resource_type:{ type: String, default: 'raw' },
  originalName: { type: String, required: true },   // <— add this
  uploadedAt:   { type: Date,   default: Date.now }
});

const mediaSchema = new mongoose.Schema({
  url:          { type: String, required: true },
  resource_type:{ type: String, enum: ['image','video'], default: 'image' },
  uploadedAt:   { type: Date,   default: Date.now }
});

const interviewDateSchema = new mongoose.Schema({
  date: { type: Date,   required: true },
  time: { type: String, required: true }
});

const userInvolvedSchema = new mongoose.Schema({
  name:  { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true }
});

const serviceSchema = new mongoose.Schema(
  {
    serviceName: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    coverImage:  { type: String, required: true }, // Cloudinary URL

    documents:   [ documentSchema ],  // <— embed documentSchema
    media:       [ mediaSchema ],
    interviewDates: [ interviewDateSchema ],
    usersInvolved: [ userInvolvedSchema ]
  },
  { timestamps: true }
);

export default mongoose.model("Service", serviceSchema);
