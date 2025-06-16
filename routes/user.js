import express from "express";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";
import User from "../models/user.js";
import bcrypt from "bcryptjs";

import upload from '../config/multer.js';
import cloudinary from '../config/cloudinary.js';
import { extractPublicId } from '../utils/cloudinaryUtils.js';

const router = express.Router();


// ✅ Get all users (admin only)
router.get("/all", authMiddleware, adminMiddleware, async (req, res, next) => {
    try {
        const users = await User.find().select("-password");
        res.json(users);
    } catch (error) {
        next(error);
    }
});


/**
 * PUT /:id - Update user profile information
 *   - Updates firstName, lastName, email
 *   - Handles CV upload (deletes old CV if exists)
 */
router.put(
  '/me',
  authMiddleware, // Ensure user is authenticated
  upload.single('cv'), // Handle single CV file upload
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Assets to delete from Cloudinary (for CV)
      const assetsToDelete = [];

      // 1) Update basic profile fields if provided
      if (req.body.firstName) user.firstName = req.body.firstName;
      if (req.body.lastName) user.lastName = req.body.lastName;
      if (req.body.email) user.email = req.body.email;

      // 2) Handle CV upload if a new file was provided
      if (req.file) {
        // Schedule deletion of old CV from Cloudinary if it exists
        if (user.cv?.url) {
          assetsToDelete.push({
            url: user.cv.url,
            resource_type: user.cv.resource_type || 'raw'
          });
        }

        // Update CV information
        user.cv = {
          url: req.file.path,
          resource_type: 'raw',
          originalName: req.file.originalname
        };
      }

      // 3) Save the updated user
      await user.save();

      // 4) Delete old Cloudinary assets (CV)
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

      // 5) Return the updated user
      const updatedUser = await User.findById(req.user._id).select('-password -resetPasswordToken -resetPasswordExpire');
      
      return res.json({
        _id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        cv: updatedUser.cv,
        createdAt: updatedUser.createdAt
      });
    } catch (err) {
      console.error('Update error:', err);
      return res.status(400).json({ error: err.message });
    }
  }
);

// 🔐 Change password (authenticated user)
router.put("/change-password", authMiddleware, async (req, res, next) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const userId = req.user._id;

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: "New passwords don't match" });
        }

        // Get user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Current password is incorrect" });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password
        user.password = hashedPassword;
        await user.save();

        res.json({ message: "Password updated successfully" });
    } catch (error) {
        next(error);
    }
});

// ❌ Delete a user by ID (admin only)
router.delete("/:id", authMiddleware, adminMiddleware, async (req, res, next) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id);
        if (!deletedUser) return res.status(404).json({ message: "User not found" });

        res.json({ message: "User deleted successfully" });
    } catch (error) {
        next(error);
    }
});

// ✏️ Edit a user by ID (admin only)
router.put("/:id", authMiddleware, adminMiddleware, async (req, res, next) => {
    try {
        const { firstName, email, role } = req.body;

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { firstName, email, role },
            { new: true, runValidators: true }
        ).select("-password");

        if (!updatedUser) return res.status(404).json({ message: "User not found" });

        res.json(updatedUser);
    } catch (error) {
        next(error);
    }
});






export default router;