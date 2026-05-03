import type { ZodTypeAny, z } from "zod";
import {
  ApiError,
  NetworkError,
  ResponseValidationError,
} from "./errors";

export type ApiClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  getAuthToken?: () => string | null | Promise<string | null>;
  defaultHeaders?: Record<string, string>;
};

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type RequestOptions<TSchema extends ZodTypeAny> = {
  method?: HttpMethod;
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  responseSchema: TSchema;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly getAuthToken?: () => string | null | Promise<string | null>;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    if (options.getAuthToken) {
      this.getAuthToken = options.getAuthToken;
    }
    this.defaultHeaders = options.defaultHeaders ?? {};
  }

  async request<TSchema extends ZodTypeAny>(
    options: RequestOptions<TSchema>,
  ): Promise<z.infer<TSchema>> {
    const url = this.buildUrl(options.path, options.query);
    const headers = await this.buildHeaders(options.headers);

    const init: RequestInit = {
      method: options.method ?? "GET",
      headers,
    };
    if (options.signal) {
      init.signal = options.signal;
    }
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, init);
    } catch (cause) {
      throw new NetworkError("Request failed before reaching the server", {
        cause,
      });
    }

    const rawText = await response.text();
    const parsedJson = rawText.length > 0 ? safeJsonParse(rawText) : null;

    if (!response.ok) {
      const errorBody = isErrorPayload(parsedJson) ? parsedJson : null;
      throw new ApiError(
        response.status,
        errorBody?.code ?? "UNKNOWN",
        errorBody?.message ?? response.statusText,
      );
    }

    const result = options.responseSchema.safeParse(parsedJson);
    if (!result.success) {
      throw new ResponseValidationError(
        "Server response did not match expected schema",
        result.error.issues,
      );
    }
    return result.data as z.infer<TSchema>;
  }

  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${normalizedPath}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private async buildHeaders(
    extra?: Record<string, string>,
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...this.defaultHeaders,
      ...(extra ?? {}),
    };
    if (this.getAuthToken) {
      const token = await this.getAuthToken();
      if (token !== null && token !== undefined && token.length > 0) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
    return headers;
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isErrorPayload(
  value: unknown,
): value is { code?: string; message?: string } {
  return typeof value === "object" && value !== null;
}
