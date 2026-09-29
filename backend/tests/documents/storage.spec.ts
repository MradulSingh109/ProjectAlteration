import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalStorageService } from "@/infrastructure/storage/local-storage.service";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

describe("Local Storage Service & Traversal Defense", () => {
  let tempStorageRoot: string;
  let storage: LocalStorageService;

  beforeEach(async () => {
    // Isolated temporary directory for every test run
    tempStorageRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "nwis-storage-test-"),
    );
    storage = new LocalStorageService(tempStorageRoot);
  });

  afterEach(async () => {
    // Purge temporary directory
    try {
      await fs.rm(tempStorageRoot, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it("stores, retrieves, verifies existence, and deletes binary documents", async () => {
    const key = "documents/well-01/completion-report.pdf";
    const payload = Buffer.from("%PDF-1.4\nTest Binary Data");

    // 1. Initially does not exist
    expect(await storage.exists(key)).toBe(false);
    expect(await storage.get(key)).toBeNull();

    // 2. Put binary
    await storage.put(key, payload);

    // 3. Exists and retrieves matching buffer
    expect(await storage.exists(key)).toBe(true);
    const retrieved = await storage.get(key);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.equals(payload)).toBe(true);

    // 4. Delete binary
    await storage.delete(key);
    expect(await storage.exists(key)).toBe(false);
    expect(await storage.get(key)).toBeNull();
  });

  it("is idempotent when deleting non-existent files", async () => {
    await expect(
      storage.delete("documents/non-existent.pdf"),
    ).resolves.not.toThrow();
  });

  it("rejects path traversal attempts containing '..' segments", async () => {
    const payload = Buffer.from("Exploit payload");

    await expect(storage.put("../secret.txt", payload)).rejects.toThrow(
      /directory traversal/i,
    );

    await expect(
      storage.put("documents/../../etc/passwd", payload),
    ).rejects.toThrow(/directory traversal/i);

    await expect(storage.get("../secret.txt")).rejects.toThrow(
      /directory traversal/i,
    );

    await expect(storage.delete("../secret.txt")).rejects.toThrow(
      /directory traversal/i,
    );
  });

  it("rejects absolute paths and drive letter references", async () => {
    const payload = Buffer.from("Exploit");

    await expect(storage.put("/etc/hosts", payload)).rejects.toThrow(
      /absolute paths are not permitted/i,
    );

    await expect(
      storage.put("C:\\Windows\\System32\\cmd.exe", payload),
    ).rejects.toThrow(/absolute paths are not permitted/i);
  });

  it("rejects null byte injection in storage keys", async () => {
    const payload = Buffer.from("Exploit");

    await expect(
      storage.put("documents/test.pdf\0.exe", payload),
    ).rejects.toThrow(/null byte injection/i);
  });

  it("rejects empty storage keys", async () => {
    await expect(storage.put("", Buffer.from("data"))).rejects.toThrow(
      /Storage key cannot be empty/i,
    );
  });
});
