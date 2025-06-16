import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: { 
      type: String,
      required: true,
      trim: true
    },
    lastName: { 
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { 
      type: String, 
      required: true 
    },
    role: { 
      type: String, 
      enum: ["user", "admin"], 
      default: "user" 
    },
    resetPasswordToken: { 
      type: String, 
      default: null 
    },
    resetPasswordExpire: { 
      type: Date, 
      default: null 
    },
    cv: {
      url: { type: String },
      resource_type: { type: String, default: "raw" },
      originalName: { type: String },
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;