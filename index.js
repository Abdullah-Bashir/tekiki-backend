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
import applicationRoutes from "./routes/application.js"
import { errorHandler } from "./middleware/errorHandler.js";

dotenv.config();

const app = express();

// Rate limiting setup
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Adjust based on your traffic
    message: "Too many requests from this IP, please try again later.",
});

const allowedOrigins = [
    "https://tekiki-frontend.vercel.app",
    "http://localhost:3000"
];

app.use(
    cors({
        origin: (incomingOrigin, callback) => {
            // Allow requests with no Origin (e.g. Postman, mobile apps, curl)
            if (!incomingOrigin) return callback(null, true);

            // Strip any trailing slash before matching
            const normalized = incomingOrigin.replace(/\/$/, "");

            if (allowedOrigins.includes(normalized)) {
                return callback(null, true);
            }

            console.error(`CORS blocked: ${incomingOrigin}`);
            return callback(new Error("Not allowed by CORS"));
        },
        credentials: true,
    })
);

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
app.use("/api/application", applicationRoutes)

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
