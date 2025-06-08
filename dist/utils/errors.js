"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.ResourceNotFoundError = exports.DatabaseError = exports.AIServiceError = exports.ValidationError = exports.InsufficientCreditsError = exports.AuthorizationError = exports.AuthenticationError = exports.AppError = void 0;
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
        super(`Insufficient credits. Required: ${required}, Available: ${available}`, 403, 'INSUFFICIENT_CREDITS');
    }
}
exports.InsufficientCreditsError = InsufficientCreditsError;
class ValidationError extends AppError {
    constructor(message) {
        super(message, 400, 'VALIDATION_ERROR');
    }
}
exports.ValidationError = ValidationError;
class AIServiceError extends AppError {
    constructor(message = 'AI service error occurred') {
        super(message, 503, 'AI_SERVICE_ERROR');
    }
}
exports.AIServiceError = AIServiceError;
class DatabaseError extends AppError {
    constructor(message = 'Database operation failed') {
        super(message, 500, 'DATABASE_ERROR');
    }
}
exports.DatabaseError = DatabaseError;
class ResourceNotFoundError extends AppError {
    constructor(resource) {
        super(`${resource} not found`, 404, 'NOT_FOUND');
    }
}
exports.ResourceNotFoundError = ResourceNotFoundError;
// Error handler middleware
const errorHandler = (err, req, res, next) => {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            status: 'error',
            code: err.code,
            message: err.message,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        });
    }
    // Handle Prisma errors
    if (err.name === 'PrismaClientKnownRequestError') {
        return res.status(400).json({
            status: 'error',
            code: 'DATABASE_ERROR',
            message: 'Database operation failed',
            ...(process.env.NODE_ENV === 'development' && { details: err.message })
        });
    }
    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            status: 'error',
            code: 'INVALID_TOKEN',
            message: 'Invalid token'
        });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            status: 'error',
            code: 'TOKEN_EXPIRED',
            message: 'Token expired'
        });
    }
    // Handle unknown errors
    console.error('Unhandled error:', err);
    return res.status(500).json({
        status: 'error',
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};
exports.errorHandler = errorHandler;
