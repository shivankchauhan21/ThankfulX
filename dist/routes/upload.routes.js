"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const file_service_1 = require("../services/file.service");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = express_1.default.Router();
// Configure multer for file upload
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path_1.default.join(__dirname, '../../temp');
        // Create temp directory if it doesn't exist
        if (!fs_1.default.existsSync(uploadDir)) {
            fs_1.default.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({
    storage,
    fileFilter: (req, file, cb) => {
        // Accept only Excel and CSV files
        const allowedTypes = ['.xlsx', '.xls', '.csv'];
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        }
        else {
            cb(new errors_1.AppError('Invalid file type. Only Excel and CSV files are allowed.', 400, 'INVALID_FILE_TYPE'));
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});
// Upload endpoint
const uploadHandler = async (req, res, next) => {
    var _a, _b;
    try {
        if (!req.file) {
            res.status(400).json({
                status: 'error',
                message: 'No file uploaded',
                code: 'NO_FILE'
            });
            return;
        }
        logger_1.logger.info('File upload received', {
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });
        const customers = await (0, file_service_1.processFile)(req.file.path);
        // Clean up: Delete the file after processing
        try {
            fs_1.default.unlinkSync(req.file.path);
            logger_1.logger.debug('Temporary file deleted', { path: req.file.path });
        }
        catch (error) {
            logger_1.logger.warn('Failed to delete temporary file', {
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
    }
    catch (error) {
        logger_1.logger.error('File processing failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            filename: (_a = req.file) === null || _a === void 0 ? void 0 : _a.originalname
        });
        if (error instanceof errors_1.AppError) {
            res.status(error.statusCode).json({
                status: 'error',
                message: error.message,
                code: error.code
            });
            return;
        }
        // Clean up file if it exists
        if (((_b = req.file) === null || _b === void 0 ? void 0 : _b.path) && fs_1.default.existsSync(req.file.path)) {
            try {
                fs_1.default.unlinkSync(req.file.path);
                logger_1.logger.debug('Temporary file deleted after error', { path: req.file.path });
            }
            catch (cleanupError) {
                logger_1.logger.warn('Failed to delete temporary file after error', {
                    path: req.file.path,
                    error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error'
                });
            }
        }
        next(error);
    }
};
// Apply authentication, multer middleware and route handler
router.post('/', authMiddleware_1.authenticateToken, upload.single('file'), uploadHandler);
exports.default = router;
