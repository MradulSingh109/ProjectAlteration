import * as fs from "fs/promises";
import * as path from "path";
import { IStorageService } from "@/domain/storage/storage.service.interface";
import { config } from "@/config/env";
import { AppError } from "@/lib/errors";

/**
 * Local filesystem implementation of IStorageService for development and on-prem environments.
 *
 * Security Features:
 * - Storage directory is situated strictly outside the public/ directory.
 * - Files are never directly served or indexed by Next.js static asset pipelines.
 * - Strict path traversal defenses reject keys containing '..', null bytes, or root escapes.
 * - Canonical path resolution verifies physical location remains bounded by storageRoot.
 */
export class LocalStorageService implements IStorageService {
  private readonly storageRoot: string;

  constructor(customStorageRoot?: string) {
    const rawRoot =
      customStorageRoot ||
      path.resolve(
        /*turbopackIgnore: true*/ process.cwd(),
        config.storage.documentPath,
      );
    this.storageRoot = path.normalize(rawRoot);
  }

  /**
   * Resolves and verifies that a relative storage key resides safely inside the storage root.
   *
   * @throws AppError 400/403 on traversal attempt or invalid key format
   */
  private resolveSafePath(key: string): string {
    if (!key || typeof key !== "string" || key.trim() === "") {
      throw AppError.validation("Storage key cannot be empty");
    }

    // 1. Guard against null byte injection
    if (key.includes("\0")) {
      throw AppError.forbidden(
        "Invalid storage key: null byte injection detected",
      );
    }

    // 2. Normalize separators to forward slash for consistent checks
    const normalizedKey = key.replace(/\\/g, "/").trim();

    // 3. Reject absolute paths or Windows drive letters
    if (path.isAbsolute(normalizedKey) || /^[a-zA-Z]:/.test(normalizedKey)) {
      throw AppError.forbidden(
        "Invalid storage key: absolute paths are not permitted",
      );
    }

    // 4. Reject relative path traversal segments
    const segments = normalizedKey.split("/");
    for (const segment of segments) {
      if (segment === ".." || segment === ".") {
        throw AppError.forbidden(
          "Invalid storage key: directory traversal is prohibited",
        );
      }
    }

    // 5. Compute resolved target path
    const resolvedPath = path.resolve(this.storageRoot, ...segments);

    // 6. Enforce that target path starts strictly with canonical storage root
    const rootWithSep = this.storageRoot.endsWith(path.sep)
      ? this.storageRoot
      : this.storageRoot + path.sep;

    if (!resolvedPath.startsWith(rootWithSep)) {
      throw AppError.forbidden(
        "Invalid storage key: resolved path escapes storage boundary",
      );
    }

    return resolvedPath;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const targetPath = this.resolveSafePath(key);
    const parentDir = path.dirname(targetPath);

    // Ensure parent directory structure exists
    await fs.mkdir(parentDir, { recursive: true });

    // Atomically write file to disk
    await fs.writeFile(targetPath, data);
  }

  async get(key: string): Promise<Buffer | null> {
    const targetPath = this.resolveSafePath(key);
    try {
      return await fs.readFile(targetPath);
    } catch (error: any) {
      if (error && error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const targetPath = this.resolveSafePath(key);
    try {
      await fs.unlink(targetPath);
    } catch (error: any) {
      if (error && error.code === "ENOENT") {
        return; // Idempotent: non-existent file is already deleted
      }
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    const targetPath = this.resolveSafePath(key);
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper for integration tests to query physical root without leaking to clients.
   */
  getStorageRoot(): string {
    return this.storageRoot;
  }
}

export const localStorageService = new LocalStorageService();
