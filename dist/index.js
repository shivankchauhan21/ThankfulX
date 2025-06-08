"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_rate_limit_1 = require("express-rate-limit");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const errors_1 = require("./utils/errors");
const logger_1 = require("./utils/logger");
// Load environment variables
dotenv_1.default.config();
// Import routes
const upload_routes_1 = __importDefault(require("./routes/upload.routes"));
const message_routes_1 = __importDefault(require("./routes/message.routes"));
const auth_1 = __importDefault(require("./routes/auth"));
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
// CORS configuration
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:8080', // Vite's default port
    credentials: true, // Allow credentials (cookies)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
// Middleware
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
}));
app.use((0, cors_1.default)(corsOptions));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
// Rate limiting
const limiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { status: 'error', message: 'Too many requests, please try again later' }
});
app.use(limiter);
// Routes
app.use('/api/upload', upload_routes_1.default);
app.use('/api/messages', message_routes_1.default);
app.use('/api/auth', auth_1.default);
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
// Error handling middleware (must be last)
app.use(errors_1.errorHandler);
// Unhandled promise rejection handler
process.on('unhandledRejection', (error) => {
    logger_1.logger.error('Unhandled Promise Rejection', { error });
    // In production, you might want to gracefully shutdown
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
});
// Uncaught exception handler
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught Exception', { error });
    // In production, you might want to gracefully shutdown
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
});
app.listen(port, () => {
    logger_1.logger.info(`Server is running on port ${port}`);
});
