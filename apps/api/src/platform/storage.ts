import { createClient } from '@supabase/supabase-js';
import { AppError } from './errors.js';

/** Файлы подтверждений. Браузер грузит файл по подписанной ссылке, выданной API: прямого доступа к бакету нет. */
export interface StoragePort {
  createUploadUrl(path: string): Promise<{ signedUrl: string; token: string }>;
  createDownloadUrl(path: string, expiresInSec?: number): Promise<string>;
  ensureBucket(): Promise<void>;
}

export function supabaseStorage(url: string, secretKey: string, bucket: string): StoragePort {
  const client = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async ensureBucket() {
      const { data } = await client.storage.getBucket(bucket);
      if (data) return;
      const { error } = await client.storage.createBucket(bucket, {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
      });
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
  };
}

/** Хранилище для тестов: ничего не грузит, возвращает предсказуемые ссылки. */
export function fakeStorage(): StoragePort {
  return {
    async ensureBucket() {},
    async createUploadUrl(path) {
      return { signedUrl: `http://storage.test/upload/${path}`, token: 'test-token' };
    },
    async createDownloadUrl(path) {
      return `http://storage.test/object/${path}`;
    },
  };
}
