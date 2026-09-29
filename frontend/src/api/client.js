/**
 * Central HTTP client for NWIS Frontend.
 * Interacts with Next.js backend on /api/v1.
 * Provides automatic session authentication, cookie management, and envelope unwrapping.
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') + '/api/v1';

let authToken = null;
let authPromise = null;

export async function ensureAuthenticated() {
  if (authToken) return authToken;
  if (authPromise) return authPromise;

  authPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        authToken = json.data?.accessToken || null;
        return authToken;
      }
    } catch (e) {
      console.warn('[NWIS Client] Auto-auth initialization notice:', e.message);
    } finally {
      authPromise = null;
    }
    return null;
  })();

  return authPromise;
}

export async function apiRequest(endpoint, options = {}) {
  // Ensure token exists before request
  const token = await ensureAuthenticated();

  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (err) {
    console.error(`[NWIS Client] Network error fetching ${url}:`, err);
    throw err;
  }

  // Handle token expiration/revocation (401)
  if (response.status === 401 && !options._retry) {
    authToken = null;
    await ensureAuthenticated();
    return apiRequest(endpoint, { ...options, _retry: true });
  }

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = json?.error?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  // Unwrap backend standard envelope: { success: true, data: ... }
  return json?.data !== undefined ? json.data : json;
}
