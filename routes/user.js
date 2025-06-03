import express from "express";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";
import User from "../models/user.js";

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
        const { username, email, role } = req.body;

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { username, email, role },
            { new: true, runValidators: true }
        ).select("-password");

        if (!updatedUser) return res.status(404).json({ message: "User not found" });

        res.json(updatedUser);
    } catch (error) {
        next(error);
    }
});

export default router;
