import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

/**
 * Image upload constraints: memory storage (so we can stream to S3), image/*
 * MIME only, size capped by UPLOAD_MAX_BYTES (default 5 MB).
 *
 * Read from process.env because interceptor decorators are evaluated at class
 * definition time, before Nest DI is available.
 */
const MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES ?? 5_242_880);

export const imageUploadOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) {
      cb(new BadRequestException('Only image/* files are allowed.'), false);
      return;
    }
    cb(null, true);
  },
};
