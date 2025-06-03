// utils/jwtUtils.js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret';
const EXPIRES_IN = '7d'; // or '1h', '30m' depending on your needs

// Generate a JWT
export const generateToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES_IN });
};

// Verify a JWT
export const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
};