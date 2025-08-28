import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { generateMessages } from '../services/message.service';
import { authenticateToken } from '../middlewares/authMiddleware';
import { validateGenerateMessage } from '../middlewares/validationMiddleware';
import prisma from '../utils/prismaClient';
import { AppError, InsufficientCreditsError } from '../utils/errors';
import { calculateCreditCost } from '../utils/creditCalculator';
import { logger } from '../utils/logger';
import { AuthRequest } from '../types/middleware';
import { MessageOptions } from '../services/message.service';

const router = express.Router();

const generateMessagesHandler: RequestHandler = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const { customers, options, organizationId } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    logger.warn('Unauthorized message generation attempt', { userId: 'unknown' });
    res.status(401).json({ 
      status: 'error',
      message: 'User not authenticated' 
    });
    return;
  }

  if (!customers || !Array.isArray(customers) || customers.length === 0) {
    logger.warn('Invalid customer data in request', { userId, customerCount: 0 });
    res.status(400).json({ 
      status: 'error',
      message: 'Customer data is required and must be a non-empty array' 
    });
    return;
  }

  try {
    logger.info('Message generation request received', {
      userId,
      customerCount: customers.length,
      organizationId,
      options: {
        style: options.style,
        length: options.length,
        language: options.language
      }
    });

    // No daily message limit - only credit-based restrictions
    // Users can generate as many messages as they have credits for

    // Calculate required credits with proper parameters
    const requiredCredits = calculateCreditCost(customers.length, {
      ...options,
      creativity: options.creativity || 0.7,
      hasProducts: customers.some(c => c.productDescription && c.productDescription.trim() !== '')
    });
    
    // Check user credits and free trial
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true, freeTrialEndsAt: true }
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Enforce one-week free trial
    if (user.freeTrialEndsAt && new Date() > user.freeTrialEndsAt) {
      res.status(403).json({
        status: 'error',
        message: 'Your free trial has expired. Please upgrade your plan to continue.',
        code: 'FREE_TRIAL_EXPIRED',
      });
      return;
    }

    if (user.credits < requiredCredits) {
      throw new InsufficientCreditsError(requiredCredits, user.credits);
    }

    // Generate messages
    logger.info('Starting message generation', { userId, customerCount: customers.length });
    
    const messages = await generateMessages({
      customers,
      options: options as MessageOptions,
      userId,
      organizationId
    });

    logger.info('Messages generated, deducting credits', { 
      userId, 
      messageCount: messages.length, 
      creditsUsed: requiredCredits 
    });

    // Deduct credits and get updated user data
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { credits: { decrement: requiredCredits } },
      select: { credits: true }
    });

    // Log successful generation
    logger.info('Messages generated successfully', {
      userId,
      messageCount: messages.length,
      creditsUsed: requiredCredits,
      responseData: {
        status: 'success',
        messages: messages.length,
        cost: requiredCredits,
        remainingCredits: updatedUser.credits
      }
    });

    res.json({
      status: 'success',
      messages,
      cost: requiredCredits,
      remainingCredits: updatedUser.credits
    });
  } catch (error) {
    logger.error('Message generation failed', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        status: 'error',
        message: error.message,
        code: error.code
      });
      return;
    }

    if (error instanceof InsufficientCreditsError) {
      res.status(402).json({
        status: 'error',
        message: error.message,
        code: 'INSUFFICIENT_CREDITS'
      });
      return;
    }

    next(error);
  }
};

// Apply middleware and route handler
router.post('/generate', authenticateToken, validateGenerateMessage, generateMessagesHandler);

export default router; 