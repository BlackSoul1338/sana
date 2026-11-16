import { createClient } from '@supabase/supabase-js';
import { AppError } from './errors.js';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

/** Evidence files. The browser uploads by a signed URL issued by the API: there is no direct bucket access. */
export interface StoragePort {
  createUploadUrl(path: string): Promise<{ signedUrl: string; token: string }>;
  createDownloadUrl(path: string, expiresInSec?: number): Promise<string>;
  /** Size and type of a stored object; null when it does not exist. */
  stat(path: string): Promise<{ size: number; contentType: string | null } | null>;
  ensureBucket(): Promise<void>;
}

export function supabaseStorage(url: string, secretKey: string, bucket: string): StoragePort {
  const client = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const limits = { public: false, fileSizeLimit: MAX_UPLOAD_BYTES, allowedMimeTypes: ALLOWED_UPLOAD_TYPES };
  return {
    async ensureBucket() {
      const { data } = await client.storage.getBucket(bucket);
      // A hand-created bucket may have no limits, so they are re-applied on every start.
      if (data) {
        const { error } = await client.storage.updateBucket(bucket, limits);
        if (error) throw new AppError('internal', 500, `Не удалось задать ограничения бакета: ${error.message}`);
        return;
      }
      const { error } = await client.storage.createBucket(bucket, limits);
      if (error && !/already exists/i.test(error.message)) throw error;
    },
    async createUploadUrl(path) {
      const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(path);
      if (error || !data) throw new AppError('internal', 500, `Не удалось выдать ссылку загрузки: ${error?.message}`);
      return { signedUrl: data.signedUrl, token: data.token };
    },
    async createDownloadUrl(path, expiresInSec = 600) {
      const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresInSec);
      if (error || !data) throw new AppError('internal', 500, `Не удалось выдать ссылку на файл: ${error?.message}`);
      return data.signedUrl;
    },
    async stat(path) {
      const slash = path.lastIndexOf('/');
      const dir = slash === -1 ? '' : path.slice(0, slash);
      const name = slash === -1 ? path : path.slice(slash + 1);
      const { data, error } = await client.storage.from(bucket).list(dir, { search: name });
      if (error) return null;
      const found = data?.find((o) => o.name === name);
      if (!found?.metadata) return null;
      return { size: found.metadata.size, contentType: found.metadata.mimetype ?? null };
    },
  };
}

/** Test store: uploads nothing, returns predictable URLs. */
export function fakeStorage(files?: Map<string, { size: number; contentType: string | null }>): StoragePort {
  const objects = files ?? new Map<string, { size: number; contentType: string | null }>();
  return {
    async ensureBucket() {},
    async createUploadUrl(path) {
      return { signedUrl: `http://storage.test/upload/${path}`, token: 'test-token' };
    },
    async createDownloadUrl(path) {
      return `http://storage.test/object/${path}`;
    },
    async stat(path) {
      return objects.get(path) ?? { size: 1024, contentType: 'image/png' };
    },
  };
}
