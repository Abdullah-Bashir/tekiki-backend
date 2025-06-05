import jwt from "jsonwebtoken"
import User from "../models/user.js";

export const generateToken = (user) => {
    return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" })
}


export const authMiddleware = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ valid: false, message: "No token provided" });
        }

        const token = authHeader.split(' ')[1];

        // Verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from DB
        const user = await User.findById(decoded.userId).select("-password");

        if (!user) {
            return res.status(401).json({ valid: false, message: "User not found" });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error("Auth Middleware Error:", error.message);

        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({ valid: false, message: "Invalid token" });
        }
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ valid: false, message: "Token expired" });
        }

        res.status(401).json({ valid: false, message: "Authorization failed" });
    }
};

export const adminMiddleware = (req, res, next) => {
    if (req.user && req.user.role === "admin") {
        next()
    } else {
        res.status(403).json({ message: "Access denied. Admin role required." })
    }
}

