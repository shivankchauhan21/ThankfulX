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

    // Calculate required credits
    const requiredCredits = calculateCreditCost(customers.length, options as MessageOptions);
    
    // Check user credits
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true }
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.credits < requiredCredits) {
      throw new InsufficientCreditsError(requiredCredits, user.credits);
    }

    // Generate messages
    const messages = await generateMessages({
      customers,
      options: options as MessageOptions,
      userId,
      organizationId
    });

    // Deduct credits
    await prisma.user.update({
      where: { id: userId },
      data: { credits: { decrement: requiredCredits } }
    });

    // Log successful generation
    logger.info('Messages generated successfully', {
      userId,
      messageCount: messages.length,
      creditsUsed: requiredCredits
    });

    res.json({
      status: 'success',
      data: {
        messages,
        creditsUsed: requiredCredits,
        remainingCredits: user.credits - requiredCredits
      }
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