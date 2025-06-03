import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        username: { type: String, required: true, unique: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true },

        role: { type: String, enum: ["user", "admin"], default: "user" },

        resetPasswordToken: { type: String, default: null },
        resetPasswordExpire: { type: Date, default: null },


        createdAt: { type: Date, default: Date.now },

        documents: [
            {
                url: { type: String, required: true },
                type: { type: String, enum: ["cv", "certificate", "other"], default: "other" },
                uploadedAt: { type: Date, default: Date.now }
            }
        ],


    },
    { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;

