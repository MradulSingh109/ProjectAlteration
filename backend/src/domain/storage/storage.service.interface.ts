/**
 * Storage port abstraction for binary document storage.
 * Completely decouples application services from specific storage technologies
 * (e.g., local disk, AWS S3, Azure Blob, Supabase Storage, GCP Cloud Storage).
 */
export interface IStorageService {
  /**
   * Persists binary data under the specified storage key.
   *
   * @param key Relative storage identifier (e.g. documents/well-123/doc-456.pdf)
   * @param data Binary payload buffer
   * @param contentType Optional MIME content type
   */
  put(key: string, data: Buffer, contentType?: string): Promise<void>;

  /**
   * Retrieves binary payload buffer for the specified storage key.
   * Returns null if key does not exist.
   */
  get(key: string): Promise<Buffer | null>;

  /**
   * Deletes the stored object under the specified storage key.
   * Idempotent: does not throw if key does not exist.
   */
  delete(key: string): Promise<void>;

  /**
   * Checks whether an object exists under the specified storage key.
   */
  exists(key: string): Promise<boolean>;
}
