import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { processFile } from '../services/file.service';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../temp');
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Accept only Excel and CSV files
    const allowedTypes = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new AppError('Invalid file type. Only Excel and CSV files are allowed.', 400, 'INVALID_FILE_TYPE'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Upload endpoint
const uploadHandler: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        status: 'error',
        message: 'No file uploaded',
        code: 'NO_FILE'
      });
      return;
    }

    logger.info('File upload received', {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    const customers = await processFile(req.file.path);
    
    // Clean up: Delete the file after processing
    try {
      fs.unlinkSync(req.file.path);
      logger.debug('Temporary file deleted', { path: req.file.path });
    } catch (error) {
      logger.warn('Failed to delete temporary file', {
        path: req.file.path,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    res.json({
      status: 'success',
      data: {
        customers,
        count: customers.length
      }
    });
  } catch (error) {
    logger.error('File processing failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      filename: req.file?.originalname
    });

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        status: 'error',
        message: error.message,
        code: error.code
      });
      return;
    }

    // Clean up file if it exists
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        logger.debug('Temporary file deleted after error', { path: req.file.path });
      } catch (cleanupError) {
        logger.warn('Failed to delete temporary file after error', {
          path: req.file.path,
          error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error'
        });
      }
    }

    next(error);
  }
};

// Apply authentication, multer middleware and route handler
router.post('/', authenticateToken, upload.single('file'), uploadHandler);

export default router; 