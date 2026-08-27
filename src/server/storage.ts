/**
 * Image uploads to Firebase Storage.
 *
 * Optional by design. Storage needs a billing plan, so the app must work
 * without it: when no bucket is configured or reachable, uploads are refused
 * with an explanation and the dashboard falls back to pasting image URLs.
 * Nothing else in the app depends on this being available.
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { readFileSync } from 'fs';
import crypto from 'crypto';

/** Formats we accept, and the extension each is stored with. */
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

/** 5 MB. Large enough for a photo, small enough to keep the page quick. */
const MAX_BYTES = 5 * 1024 * 1024;

export interface StorageConfig {
  bucket: string;
  projectId?: string;
  credentialsPath?: string;
  credentialsJson?: string;
}

export function loadStorageConfig(env: NodeJS.ProcessEnv = process.env): StorageConfig {
  return {
    bucket: (env.FIREBASE_STORAGE_BUCKET || '').trim(),
    projectId: (env.FIREBASE_PROJECT_ID || '').trim() || undefined,
    credentialsPath: (env.GOOGLE_APPLICATION_CREDENTIALS || '').trim() || undefined,
    credentialsJson: (env.FIREBASE_SERVICE_ACCOUNT || '').trim() || undefined,
  };
}

function ensureApp(config: StorageConfig): void {
  if (getApps().length > 0) return;

  let serviceAccount: Record<string, string> | undefined;
  if (config.credentialsJson) serviceAccount = JSON.parse(config.credentialsJson);
  else if (config.credentialsPath) {
    serviceAccount = JSON.parse(readFileSync(config.credentialsPath, 'utf8'));
  }
  if (!serviceAccount) throw new Error('No Firebase credentials configured.');

  initializeApp({
    credential: cert(serviceAccount as never),
    projectId: config.projectId ?? serviceAccount.project_id,
    storageBucket: config.bucket,
  });
}

export interface UploadResult {
  ok: boolean;
  url?: string;
  error?: string;
}

/**
 * Decodes a `data:` URI into bytes.
 *
 * The dashboard reads the chosen file with FileReader and posts a data URI,
 * which avoids multipart parsing on the server for what is a handful of
 * images. Returns null when the string is not a supported image.
 */
export function decodeDataUri(
  value: string,
): { buffer: Buffer; contentType: string; extension: string } | null {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(value);
  if (!match) return null;

  const contentType = match[1].toLowerCase();
  const extension = ALLOWED_TYPES[contentType];
  if (!extension) return null;

  const buffer = Buffer.from(match[2], 'base64');
  return { buffer, contentType, extension };
}

export class ImageStorage {
  readonly configured: boolean;

  constructor(private readonly config: StorageConfig) {
    this.configured = Boolean(
      config.bucket && (config.credentialsJson || config.credentialsPath),
    );
  }

  /** True when the bucket actually exists, not merely when it is named. */
  async isAvailable(): Promise<boolean> {
    if (!this.configured) return false;
    try {
      ensureApp(this.config);
      const [exists] = await getStorage().bucket(this.config.bucket).exists();
      return exists;
    } catch {
      return false;
    }
  }

  /**
   * Stores an image and returns a public URL.
   *
   * Files are made public deliberately: these are event photos and a logo,
   * rendered by an <img> tag on a public page. Signed URLs would expire and
   * silently break the page later.
   */
  async upload(dataUri: string, folder = 'gallery'): Promise<UploadResult> {
    if (!this.configured) {
      return {
        ok: false,
        error:
          'Firebase Storage is not configured. Set FIREBASE_STORAGE_BUCKET, or paste an image URL instead.',
      };
    }

    const decoded = decodeDataUri(dataUri);
    if (!decoded) {
      return {
        ok: false,
        error: `Unsupported image. Allowed types: ${Object.keys(ALLOWED_TYPES).join(', ')}.`,
      };
    }
    if (decoded.buffer.byteLength > MAX_BYTES) {
      return {
        ok: false,
        error: `Image is ${(decoded.buffer.byteLength / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_BYTES / 1024 / 1024} MB.`,
      };
    }

    try {
      ensureApp(this.config);
      const bucket = getStorage().bucket(this.config.bucket);

      const [exists] = await bucket.exists();
      if (!exists) {
        return {
          ok: false,
          error: `Bucket "${this.config.bucket}" does not exist. Enable Storage in the Firebase console, or paste an image URL instead.`,
        };
      }

      const name = `${folder}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${decoded.extension}`;
      const file = bucket.file(name);

      await file.save(decoded.buffer, {
        contentType: decoded.contentType,
        // Content is immutable — every upload gets a fresh name — so it can be
        // cached hard.
        metadata: { cacheControl: 'public, max-age=31536000, immutable' },
      });
      await file.makePublic();

      return { ok: true, url: `https://storage.googleapis.com/${this.config.bucket}/${name}` };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}
