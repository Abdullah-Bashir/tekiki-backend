// index.js
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js"
import serviceRoutes from "./routes/service.js"
import { errorHandler } from "./middleware/errorHandler.js";

dotenv.config();

const app = express();

// Rate limiting setup
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Adjust based on your traffic
    message: "Too many requests from this IP, please try again later.",
});

// CORS middleware configuration
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Normalize the origin by removing any trailing slash
        const normalizedOrigin = origin.replace(/\/$/, "");
        // Allowed origin from environment variable or fallback
        const allowedOrigin = (process.env.FRONTEND_URL || 'https://tekiki-frontend.vercel.app/').replace(/\/$/, "");

        // Compare the normalized incoming origin with the allowed origin
        if (normalizedOrigin === allowedOrigin) {
            return callback(null, true);
        } else {
            console.error(`CORS error: Request from origin "${normalizedOrigin}" not allowed.`);
            return callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

// Standard middleware
app.use(express.json());
app.use(cookieParser());
app.use(limiter);



// Simple home route
app.get("/", (req, res) => {
    res.send("Welcome to the react Backend!");
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/service", serviceRoutes);

// Error handling middleware
app.use(errorHandler);

// MongoDB connection
mongoose.set("strictQuery", false);
mongoose
    .connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log("Connected to MongoDB");
    })
    .catch((err) => console.error("MongoDB connection error:", err));

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
