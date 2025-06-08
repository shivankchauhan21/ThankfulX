import { Response, NextFunction, RequestHandler, Request } from 'express';
import { verifyJwt } from '../utils/authUtils';
import { AppError, AuthenticationError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface AuthUser {
  id: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export const authenticateToken: RequestHandler = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const token = req.cookies['token'];
    if (!token) {
      throw new AuthenticationError('Authentication token missing');
    }

    const decoded = verifyJwt(token);
    if (!decoded || typeof decoded === 'string') {
      throw new AuthenticationError('Invalid or expired token');
    }

    // Map the decoded token to AuthUser type
    const { userId, role } = decoded as { userId: string; role: string };
    req.user = { id: userId, role };

    logger.debug('User authenticated', { userId, role });
    next();
  } catch (error) {
    logger.warn('Authentication failed', {
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

    res.status(401).json({
      status: 'error',
      code: 'AUTHENTICATION_ERROR',
      message: 'Authentication failed'
    });
  }
}; 