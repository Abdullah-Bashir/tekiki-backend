import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
    {
        serviceName: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            required: true
        },

        coverImage: {
            type: String, // URL stored from Cloudinary
            required: true
        },

        documents: [
            {
                url: { type: String, required: true },
                uploadedAt: { type: Date, default: Date.now },
                resource_type: { type: String, default: 'raw' }
            }
        ],

        media: [
            {
                url: { type: String, required: true },
                resource_type: { type: String, enum: ['image', 'video'], default: 'image' },
                uploadedAt: { type: Date, default: Date.now }
            }
        ],

        interviewDates: [
            {
                date: { type: Date, required: true }, // e.g., "2025-06-01"
                time: { type: String, required: true } // e.g., "14:30"
            }
        ],

        usersInvolved: [
            {
                name: { type: String, trim: true },
                email: { type: String, lowercase: true, trim: true }
            }
        ]
    },
    { timestamps: true }
);

const Service = mongoose.model("Service", serviceSchema);

export default Service;
