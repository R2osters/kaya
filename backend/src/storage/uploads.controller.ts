import {
  BadRequestException,
  Controller,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StorageService } from './storage.service';

/** Logical folders an app may upload into, and nothing else. */
const PREFIXES = ['delivery-photos', 'profile-photos'] as const;
type UploadPrefix = (typeof PREFIXES)[number];

/** Images only, and only formats a phone camera actually produces. */
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

/**
 * 8 MB. The apps compress before uploading (ImageAdapter.compress), so a
 * request anywhere near this ceiling is a client that skipped that step, not a
 * legitimately large photo. The limit exists so it cannot fill the bucket.
 */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * File upload for the apps.
 *
 * `StorageService` has existed since the first milestone and nothing exposed
 * it: the driver's pickup photo is required by the delivery flow, and without
 * this endpoint the app could only send the local `file:///...` path of the
 * shot, which is a path on one phone's private storage -- a photo the client
 * can never see and support can never review. Storing that in `pickup_photo`
 * would look like the feature worked.
 *
 * The response is the object KEY, not a URL. The bucket is private by design
 * (identity documents live in it too); reads go through short-lived presigned
 * URLs that `StorageService.resolvePhoto` mints when a response includes the
 * photo. Handing out a durable URL here would undo that.
 */
@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post(':prefix')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an image; returns the storage key to persist.' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  async upload(
    @Param('prefix') prefix: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<{ key: string }> {
    if (!isAllowedPrefix(prefix)) {
      // Not a 404: the caller sent a folder name, and telling them it is not
      // one of the two accepted is more useful than pretending the route is
      // missing. The allow-list itself is what stops an arbitrary path being
      // written into the bucket.
      throw new BadRequestException(`Unknown upload target "${prefix}".`);
    }
    if (!file) {
      throw new BadRequestException('No file was uploaded.');
    }
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported image type "${file.mimetype}".`);
    }

    const key = await this.storage.upload(prefix, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
    });
    return { key };
  }
}

function isAllowedPrefix(value: string): value is UploadPrefix {
  return (PREFIXES as readonly string[]).includes(value);
}
