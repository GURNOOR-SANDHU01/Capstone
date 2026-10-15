/**
 * Central HTTP client for the SentiMed Express API.
 *
 * - Base URL from VITE_API_BASE_URL (defaults to "/api", proxied to the backend by Vite in dev)
 * - Attaches the signed-in user's Firebase ID token as a Bearer token
 * - Unwraps the backend envelope { success, data, pagination } / { success:false, error:{code,message} }
 * - Normalizes network, timeout and HTTP failures into ApiError with a user-friendly message
 */
import { auth } from "./firebase";

const BASE_URL = (import.meta.env?.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const DEFAULT_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  constructor(message, { status = 0, code = "NETWORK_ERROR", details = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const FRIENDLY_MESSAGES = {
  NETWORK_ERROR: "Cannot reach the SentiMed server. Check your connection and that the backend is running.",
  TIMEOUT: "The server took too long to respond. Please try again.",
  UNAUTHORIZED: "Your session has ended. Please sign in again.",
  TOKEN_EXPIRED: "Your session has expired. Please sign in again.",
  TOKEN_REVOKED: "Your access changed. Please sign in again.",
  RATE_LIMIT_EXCEEDED: "Too many requests. Please wait a moment and try again.",
  SERVICE_NOT_READY: "This feature is temporarily unavailable while the database finishes setting up. Please try again later.",
  INTERNAL_ERROR: "Something went wrong on the server. Please try again."
};

export function describeError(err) {
  if (err instanceof ApiError) return FRIENDLY_MESSAGES[err.code] || err.message;
  return err?.message || "Something went wrong.";
}

async function getIdToken(forceRefresh = false) {
  const user = auth?.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

async function send(method, path, { body, query, timeoutMs = DEFAULT_TIMEOUT_MS, retryOnAuth = true } = {}) {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    });
  }

  const headers = { Accept: "application/json" };
  const token = await getIdToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === "AbortError") throw new ApiError(FRIENDLY_MESSAGES.TIMEOUT, { code: "TIMEOUT" });
    throw new ApiError(FRIENDLY_MESSAGES.NETWORK_ERROR, { code: "NETWORK_ERROR" });
  } finally {
    clearTimeout(timer);
  }

  let payload = null;
  if (response.status !== 204) {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  }

  if (!response.ok || payload?.success === false) {
    const code = payload?.error?.code || (response.status === 401 ? "UNAUTHORIZED" : "HTTP_ERROR");
    // An expired token is refreshed once transparently
    if (response.status === 401 && retryOnAuth && code === "TOKEN_EXPIRED" && auth?.currentUser) {
      await getIdToken(true);
      return send(method, path, { body, query, timeoutMs, retryOnAuth: false });
    }
    throw new ApiError(payload?.error?.message || `Request failed (${response.status})`, {
      status: response.status,
      code,
      details: payload?.error?.details || null
    });
  }

  return { data: payload?.data ?? null, pagination: payload?.pagination ?? null };
}

export const api = {
  get: (path, query, opts) => send("GET", path, { ...opts, query }),
  post: (path, body, opts) => send("POST", path, { ...opts, body }),
  put: (path, body, opts) => send("PUT", path, { ...opts, body }),
  patch: (path, body, opts) => send("PATCH", path, { ...opts, body }),
  delete: (path, body, opts) => send("DELETE", path, { ...opts, body })
};
