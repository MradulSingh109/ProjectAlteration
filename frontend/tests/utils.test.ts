import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn utility", () => {
  it("should merge single class string correctly", () => {
    expect(cn("px-4")).toBe("px-4");
  });

  it("should merge multiple class strings", () => {
    expect(cn("px-4", "py-2", "text-sm")).toBe("px-4 py-2 text-sm");
  });

  it("should handle conflicting tailwind classes by keeping the last one", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("should ignore falsy values, null, and undefined", () => {
    expect(cn("px-4", false && "py-2", null, undefined, "text-sm")).toBe(
      "px-4 text-sm"
    );
  });
});
