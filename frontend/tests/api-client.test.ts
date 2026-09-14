import { describe, it, expect } from "vitest";
import { apiClient, API_BASE_URL } from "@/lib/api/client";
import { ApiClientError } from "@/lib/api/errors";

describe("API Client Architecture", () => {
  it("initializes apiClient with configured or default baseURL", () => {
    expect(apiClient.defaults.baseURL).toBe(API_BASE_URL);
    expect(apiClient.defaults.headers["Content-Type"]).toBe("application/json");
    expect(apiClient.defaults.headers["Accept"]).toBe("application/json");
  });

  it("creates ApiClientError with custom code and message", () => {
    const error = new ApiClientError("Validation failed", {
      code: "VALIDATION_ERROR",
      statusCode: 400,
      details: { field: "name" },
    });

    expect(error.name).toBe("ApiClientError");
    expect(error.message).toBe("Validation failed");
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual({ field: "name" });
  });

  it("converts unknown error to ApiClientError", () => {
    const rawError = new Error("Something broke");
    const apiError = ApiClientError.fromUnknown(rawError);

    expect(apiError).toBeInstanceOf(ApiClientError);
    expect(apiError.message).toBe("Something broke");
    expect(apiError.code).toBe("CLIENT_ERROR");
  });
});
