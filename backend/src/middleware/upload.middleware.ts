import { Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { ALLOWED_MIME_TYPES } from '../utils/fileValidation';

const maxSizeBytes = env.MAX_FILE_SIZE_MB * 1024 * 1024;

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: maxSizeBytes,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as any)) {
      return cb(
        AppError.badRequest(
          `Unsupported file type '${file.mimetype}'. Only JPEG, PNG, and WebP images are allowed.`,
          'UNSUPPORTED_FILE_TYPE'
        )
      );
    }
    cb(null, true);
  },
});

const singleUploadHandler = upload.single('file');

/**
 * Express middleware wrapper for single image file upload using Multer.
 * Converts Multer errors into standard AppError responses.
 */
export const uploadImageMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  singleUploadHandler(req, res, (err: any) => {
    if (err) {
      if (err instanceof MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            AppError.badRequest(
              `File size exceeds maximum allowed limit of ${env.MAX_FILE_SIZE_MB} MB`,
              'FILE_TOO_LARGE'
            )
          );
        }
        return next(AppError.badRequest(err.message, 'INVALID_FILE_UPLOAD'));
      }
      return next(err);
    }
    next();
  });
};
