import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { logger } from '../config/logger';

export interface StorageUploadResult {
  url: string;
  key: string;
}

export interface IStorageService {
  upload(fileBuffer: Buffer, pathKey: string, mimeType: string): Promise<StorageUploadResult>;
  getUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}

/**
 * Supabase Storage Implementation of IStorageService
 */
export class SupabaseStorageService implements IStorageService {
  private client: SupabaseClient;
  private bucket: string;

  constructor() {
    this.bucket = env.SUPABASE_STORAGE_BUCKET;
    this.client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }

  async upload(fileBuffer: Buffer, pathKey: string, mimeType: string): Promise<StorageUploadResult> {
    // If in test mode with mock credentials, return simulated upload result unless overridden
    if (env.NODE_ENV === 'test' && env.SUPABASE_URL.includes('mock.supabase.co')) {
      const mockUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${this.bucket}/${pathKey}`;
      return { url: mockUrl, key: pathKey };
    }

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .upload(pathKey, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      logger.error({ err: error, pathKey }, 'Supabase Storage upload failed');
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    const { data: publicUrlData } = this.client.storage.from(this.bucket).getPublicUrl(data.path);

    return {
      url: publicUrlData.publicUrl,
      key: data.path,
    };
  }

  async getUrl(key: string): Promise<string> {
    if (env.NODE_ENV === 'test' && env.SUPABASE_URL.includes('mock.supabase.co')) {
      return `${env.SUPABASE_URL}/storage/v1/object/public/${this.bucket}/${key}`;
    }

    const { data } = this.client.storage.from(this.bucket).getPublicUrl(key);
    return data.publicUrl;
  }

  async delete(key: string): Promise<void> {
    if (env.NODE_ENV === 'test' && env.SUPABASE_URL.includes('mock.supabase.co')) {
      return;
    }

    const { error } = await this.client.storage.from(this.bucket).remove([key]);

    if (error) {
      logger.error({ err: error, key }, 'Supabase Storage delete failed');
      throw new Error(`Storage deletion failed: ${error.message}`);
    }
  }
}

// Export default singleton instance
export const storageService: IStorageService = new SupabaseStorageService();
