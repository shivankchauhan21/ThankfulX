"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.FileProcessingError = exports.AIServiceError = exports.DatabaseError = exports.ValidationError = exports.InsufficientCreditsError = exports.AuthorizationError = exports.AuthenticationError = exports.AppError = void 0;
const logger_1 = require("./logger");
class AppError extends Error {
    constructor(message, statusCode, code, isOperational = true) {
        super(message);
        this.message = message;
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, AppError.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401, 'AUTH_ERROR');
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends AppError {
    constructor(message = 'Not authorized to perform this action') {
        super(message, 403, 'FORBIDDEN');
    }
}
exports.AuthorizationError = AuthorizationError;
class InsufficientCreditsError extends AppError {
    constructor(required, available) {
        super(`Insufficient credits. Required: ${required}, Available: ${available}`, 402, 'INSUFFICIENT_CREDITS');
    }
}
exports.InsufficientCreditsError = InsufficientCreditsError;
class ValidationError extends AppError {
    constructor(message) {
        super(message, 400, 'VALIDATION_ERROR');
    }
}
exports.ValidationError = ValidationError;
class DatabaseError extends AppError {
    constructor(message = 'Database operation failed') {
        super(message, 500, 'DATABASE_ERROR');
    }
}
exports.DatabaseError = DatabaseError;
class AIServiceError extends AppError {
    constructor(message = 'AI service error occurred') {
        super(message, 503, 'AI_SERVICE_ERROR');
    }
}
exports.AIServiceError = AIServiceError;
class FileProcessingError extends AppError {
    constructor(message = 'File processing failed') {
        super(message, 400, 'FILE_PROCESSING_ERROR');
    }
}
exports.FileProcessingError = FileProcessingError;
// Error handler middleware
const errorHandler = (err, req, res, next) => {
    // Log the error
    logger_1.logger.error('Unhandled error:', {
        error: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        path: req.path,
        method: req.method
    });
    // Handle known error types
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            status: 'error',
            code: err.code,
            message: err.message,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        });
        return;
    }
    // Handle Prisma errors
    if (err.name === 'PrismaClientKnownRequestError') {
        res.status(400).json({
            status: 'error',
            code: 'DATABASE_ERROR',
            message: 'Database operation failed',
            ...(process.env.NODE_ENV === 'development' && { details: err.message })
        });
        return;
    }
    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        res.status(401).json({
            status: 'error',
            code: 'INVALID_TOKEN',
            message: 'Invalid token'
        });
        return;
    }
    if (err.name === 'TokenExpiredError') {
        res.status(401).json({
            status: 'error',
            code: 'TOKEN_EXPIRED',
            message: 'Token expired'
        });
        return;
    }
    // Handle multer errors
    if (err.name === 'MulterError') {
        res.status(400).json({
            status: 'error',
            code: 'FILE_UPLOAD_ERROR',
            message: err.message
        });
        return;
    }
    // Handle unknown errors
    res.status(500).json({
        status: 'error',
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};
exports.errorHandler = errorHandler;
