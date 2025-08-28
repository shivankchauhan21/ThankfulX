import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { errorHandler } from './utils/errors';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

// Import routes
import uploadRoutes from './routes/upload.routes';
import messageRoutes from './routes/message.routes';
import authRoutes from './routes/auth';

const app = express();
const port = process.env.PORT || 5000;

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:8080', // Vite's default port
  credentials: true, // Allow credentials (cookies)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
}));
app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // Higher limit for development
  message: { status: 'error', message: 'Too many requests, please try again later' }
});

// Stricter rate limiting for message generation
const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'development' ? 50 : 10, // Limit message generation requests
  message: { status: 'error', message: 'Too many message generation requests, please wait a moment' }
});

app.use(globalLimiter);

// Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/messages', messageLimiter, messageRoutes); // Apply message-specific rate limiting
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Unhandled promise rejection handler
process.on('unhandledRejection', (error: Error) => {
  logger.error('Unhandled Promise Rejection', { error });
  // In production, you might want to gracefully shutdown
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Uncaught exception handler
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', { error });
  // In production, you might want to gracefully shutdown
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

app.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
}); 