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

/**
 * Storage calls are given a deadline.
 *
 * The Firebase SDK retries internally and will sit on a request for a long
 * time when the bucket is missing or unreachable — longer than the gateway in
 * front of this app is willing to wait. The request then dies as a 504 with no
 * explanation, which is what someone uploading a photo actually saw. A refusal
 * that says why is far more useful than a hang.
 */
const BUCKET_CHECK_MS = 8_000;
/** A bucket that exists keeps existing; no need to ask again for a while. */
const AVAILABILITY_TTL_MS = 10 * 60_000;
/** A miss is rechecked sooner, so switching Storage on is noticed quickly. */
const AVAILABILITY_MISS_TTL_MS = 30_000;
const UPLOAD_MS = 20_000;

function withTimeout<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error(`${message} Paste an image URL instead, or try a smaller file.`)), ms);
      // Do not hold the process open for a timer that may never be needed.
      if (typeof timer === 'object' && 'unref' in timer) (timer as { unref(): void }).unref();
    }),
  ]);
}

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

  /**
   * True when the bucket actually exists, not merely when it is named.
   *
   * Cached, because this is a round trip to the bucket and the dashboard asks
   * on every tab that offers an upload — several seconds of waiting, repeated,
   * for an answer that changes about once in the life of a project. A negative
   * is held briefly so that enabling Storage is picked up without a restart.
   */
  private availability?: { value: boolean; until: number };

  async isAvailable(): Promise<boolean> {
    if (!this.configured) return false;

    const now = Date.now();
    if (this.availability && this.availability.until > now) return this.availability.value;

    let value = false;
    try {
      ensureApp(this.config);
      const [exists] = await withTimeout(
        getStorage().bucket(this.config.bucket).exists(),
        BUCKET_CHECK_MS,
        'Checking the storage bucket timed out.',
      );
      value = exists;
    } catch {
      value = false;
    }

    this.availability = {
      value,
      until: now + (value ? AVAILABILITY_TTL_MS : AVAILABILITY_MISS_TTL_MS),
    };
    return value;
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

      const [exists] = await withTimeout(
        bucket.exists(),
        BUCKET_CHECK_MS,
        'Checking the storage bucket timed out.',
      );
      if (!exists) {
        return {
          ok: false,
          error: `Bucket "${this.config.bucket}" does not exist. Enable Storage in the Firebase console, or paste an image URL instead.`,
        };
      }

      const name = `${folder}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${decoded.extension}`;
      const file = bucket.file(name);

      /**
       * A download token, rather than making the object public.
       *
       * Buckets created now have uniform bucket-level access switched on by
       * default, and that disables per-object ACLs outright — so makePublic()
       * throws, and the upload fails at the last step having already stored the
       * file. Firebase's own token URL does not depend on ACLs, works whether
       * uniform access is on or off, and leaves the bucket private: only files
       * carrying a token are reachable, rather than everything in it.
       */
      const downloadToken = crypto.randomUUID();

      await withTimeout(
        file.save(decoded.buffer, {
          contentType: decoded.contentType,
          metadata: {
            // Content is immutable — every upload gets a fresh name — so it can
            // be cached hard.
            cacheControl: 'public, max-age=31536000, immutable',
            metadata: { firebaseStorageDownloadTokens: downloadToken },
          },
        }),
        UPLOAD_MS,
        'The upload to storage timed out.',
      );

      const encodedPath = encodeURIComponent(name);
      return {
        ok: true,
        url:
          `https://firebasestorage.googleapis.com/v0/b/${this.config.bucket}` +
          `/o/${encodedPath}?alt=media&token=${downloadToken}`,
      };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}
