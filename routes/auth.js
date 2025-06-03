import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/user.js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { authMiddleware } from "../middleware/auth.js";
import validator from "validator"

dotenv.config(); // Load environment variables

const router = express.Router();

// Initialize Nodemailer transporter
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // Use SSL/TLS
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    tls: {
        rejectUnauthorized: false, // Do not fail on invalid certificates
    },
    debug: true, // Enable debugging
    logger: true, // Log to console
});

// Verify transporter configuration
// transporter.verify((error, success) => {
//     if (error) {
//         console.error("SMTP configuration error:", error);
//     } else {
//         console.log("SMTP server is ready to send emails");
//     }
// });


// Helper function to send email
const sendEmail = async (to, subject, html) => {
    try {
        const info = await transporter.sendMail({
            from: `"Tekiki" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        });
    } catch (error) {

        throw new Error("Failed to send email");
    }
};



// Helper function to generate JWT token
const generateToken = (user) => {
    return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "3h" });
};


// Signup Route
router.post("/signup", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Email already in use" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            username,
            email,
            password: hashedPassword,
        });

        await newUser.save();

        res.status(201).json({ message: "Signup successful" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Login Route
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, {
            expiresIn: "7d",
        });

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.status(200).json({ message: "Login successful", user: { username: user.username, email: user.email, role: user.role } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

router.get('/validate-token', authMiddleware, (req, res) => {
    res.json({
        valid: true,
        user: req.user
    });
});

router.get("/logout", (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
    });
    return res.status(200).json({ message: "Logged out successfully" });
});

// Forgot password route
router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;

        // Check if email is provided
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(20).toString("hex");

        // Hash the token and save it in the database
        user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
        user.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await user.save();

        // Generate reset URL
        const resetUrl = `${process.env.FRONTEND_URL}/resetpassword/${resetToken}`;

        // Send email with reset link
        const htmlTemplate = `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color:rgb(15, 235, 22); text-align: center;">Password Reset Request</h2>
                <p>Hello,</p>
                <p>You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
                <p>Please click on the following link, or paste it into your browser to complete the process:</p>
                <div style="background:rgba(19, 18, 7, 0.62); padding: 10px; text-align: center; border-radius: 4px; margin: 20px 0;">
                    <a href="${resetUrl}" style="color:rgb(19, 219, 25); text-decoration: none;">Reset Password</a>
                </div>
                <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
                <p>Best regards,</p>
                <p><strong>Tekiki</strong></p>
            </div>
        `;

        await transporter.sendMail({
            from: `"Tekiki" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "LMS - Password Reset Request",
            html: htmlTemplate,
        });

        res.json({ message: "Password reset email sent" });
    } catch (error) {
        console.error("Error in forgot password:", error);
        res.status(500).json({ message: "An error occurred. Please try again." });
    }
});

// reset password
router.put("/reset-password/:token", async (req, res) => {
    try {
        const { token: resetToken } = req.params; // Rename `token` to `resetToken`
        const { newPassword, confirmPassword } = req.body;

        console.log(req.body)

        // Validate input
        if (!newPassword || !confirmPassword) {
            return res.status(400).json({ message: "Both password fields are required" });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: "Passwords do not match" });
        }

        // Hash the token for comparison
        const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex"); // Use `resetToken`

        // Find user with valid token
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired token" });
        }

        // Update password and clear reset fields
        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        // Generate a new JWT
        const jwtToken = generateToken(user); // Use `jwtToken` instead of `token`

        // Set JWT in a cookie
        res.cookie("token", jwtToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 3600000, // 1 hour
            sameSite: "strict",
        });

        // Send success response
        res.json({ message: "Password reset successfully" });
    } catch (error) {

        res.status(500).json({ message: error.message || "An error occurred. Please try again." });
    }
});





export default router;