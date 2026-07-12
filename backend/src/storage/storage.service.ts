import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { AppConfigService } from '../config/app-config.service';

/**
 * S3-compatible object storage (MinIO in dev, R2/S3 in prod). The bucket is
 * PRIVATE: `upload` returns the object KEY (stored in the DB), and reads go
 * through short-lived presigned GET URLs (`getPresignedUrl`). Identity documents
 * are therefore never exposed on a public URL.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: AppConfigService) {
    this.bucket = this.config.get('S3_BUCKET');
    this.client = new S3Client({
      endpoint: this.config.get('S3_ENDPOINT'),
      region: this.config.get('S3_REGION'),
      forcePathStyle: this.config.get('S3_FORCE_PATH_STYLE'),
      credentials: {
        accessKeyId: this.config.get('S3_ACCESS_KEY'),
        secretAccessKey: this.config.get('S3_SECRET_KEY'),
      },
    });
  }

  /** Best-effort bucket creation so first-run dev uploads succeed. */
  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created object storage bucket "${this.bucket}".`);
      } catch (err) {
        this.logger.warn(
          `Object storage not reachable at boot (${(err as Error).message}). ` +
            'Uploads will fail until MinIO/S3 is available.',
        );
      }
    }
  }

  /**
   * Stores a file buffer and returns its object KEY (persisted in the DB).
   * The key is random (UUID) so it cannot be guessed and carries no path
   * traversal (the extension is sanitised to a safe suffix).
   * @param prefix logical folder, e.g. "id-cards" or "licenses".
   */
  async upload(
    prefix: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ): Promise<string> {
    const key = `${prefix}/${randomUUID()}${this.safeExt(file.originalname)}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
    return key;
  }

  /** Presigned GET URL for a stored key (default 15 min, capped by config). */
  async getPresignedUrl(key: string): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: this.config.get('S3_PRESIGN_TTL'),
    });
  }

  /**
   * Resolves a stored photo field for a response: presigns storage keys, but
   * leaves already-absolute URLs and inline data URIs (e.g. scanned QR codes)
   * untouched. Returns null on failure so a broken asset never breaks a response.
   */
  async resolvePhoto(value: string | null | undefined): Promise<string | null> {
    if (!value) {
      return null;
    }
    if (/^(https?:)?\/\//.test(value) || value.startsWith('data:')) {
      return value;
    }
    try {
      return await this.getPresignedUrl(value);
    } catch (err) {
      this.logger.warn(`Failed to presign "${value}": ${(err as Error).message}`);
      return null;
    }
  }

  /** Sanitised, lower-cased extension (letters/digits only) or empty. */
  private safeExt(originalName: string): string {
    const ext = extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, '');
    return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : '';
  }
}
