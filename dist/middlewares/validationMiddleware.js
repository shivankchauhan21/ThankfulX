"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateGenerateMessage = exports.generateMessageSchema = void 0;
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
// Define the validation schema
exports.generateMessageSchema = zod_1.z.object({
    customers: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string().min(1, 'Customer name is required'),
        productDescription: zod_1.z.string().min(1, 'Product description is required')
    })).min(1, 'At least one customer is required'),
    options: zod_1.z.object({
        style: zod_1.z.enum(['formal', 'casual', 'friendly', 'professional'], {
            errorMap: () => ({ message: 'Style must be one of: formal, casual, friendly, professional' })
        }),
        length: zod_1.z.enum(['short', 'medium', 'long'], {
            errorMap: () => ({ message: 'Length must be one of: short, medium, long' })
        }),
        language: zod_1.z.enum(['en', 'es', 'fr', 'de'], {
            errorMap: () => ({ message: 'Language must be one of: en, es, fr, de' })
        }),
        creativity: zod_1.z.number().min(0).max(1).optional(),
        hasProducts: zod_1.z.boolean().optional()
    }),
    organizationId: zod_1.z.string().uuid('Invalid organization ID format').optional()
});
// Validation middleware
const validateGenerateMessage = (req, res, next) => {
    try {
        // Validate the request body
        const validatedData = exports.generateMessageSchema.parse(req.body);
        // Replace the request body with validated data
        req.body = validatedData;
        logger_1.logger.debug('Request validation successful', {
            customerCount: validatedData.customers.length,
            options: validatedData.options
        });
        next();
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            logger_1.logger.warn('Request validation failed', {
                errors: error.errors.map((err) => ({
                    path: err.path.join('.'),
                    message: err.message
                }))
            });
            res.status(400).json({
                status: 'error',
                code: 'VALIDATION_ERROR',
                message: 'Invalid request data',
                details: error.errors.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
            return;
        }
        logger_1.logger.error('Unexpected validation error', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        if (error instanceof errors_1.AppError) {
            res.status(error.statusCode).json({
                status: 'error',
                code: error.code,
                message: error.message
            });
            return;
        }
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Internal server error during validation'
        });
    }
};
exports.validateGenerateMessage = validateGenerateMessage;
