import { Request, Response, NextFunction, RequestHandler } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

// Define the validation schema
export const generateMessageSchema = z.object({
  customers: z.array(z.object({
    name: z.string().min(1, 'Customer name is required'),
    productDescription: z.string().min(1, 'Product description is required')
  })).min(1, 'At least one customer is required'),
  options: z.object({
    style: z.enum(['formal', 'casual', 'friendly', 'professional'], {
      errorMap: () => ({ message: 'Style must be one of: formal, casual, friendly, professional' })
    }),
    length: z.enum(['short', 'medium', 'long'], {
      errorMap: () => ({ message: 'Length must be one of: short, medium, long' })
    }),
    language: z.enum(['en', 'es', 'fr', 'de'], {
      errorMap: () => ({ message: 'Language must be one of: en, es, fr, de' })
    })
  }),
  organizationId: z.string().uuid('Invalid organization ID format').optional()
});

// Type inference for the validated request body
export type GenerateMessageRequest = z.infer<typeof generateMessageSchema>;

// Validation middleware
export const validateGenerateMessage: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Validate the request body
    const validatedData = generateMessageSchema.parse(req.body);
    
    // Replace the request body with validated data
    req.body = validatedData;
    
    logger.debug('Request validation successful', {
      customerCount: validatedData.customers.length,
      options: validatedData.options
    });
    
    next();
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      logger.warn('Request validation failed', {
        errors: error.errors.map((err: z.ZodIssue) => ({
          path: err.path.join('.'),
          message: err.message
        }))
      });
      
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.errors.map((err: z.ZodIssue) => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
      return;
    }

    logger.error('Unexpected validation error', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    if (error instanceof AppError) {
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