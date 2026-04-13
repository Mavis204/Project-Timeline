/**
 * client/src/services/auth.js
 *
 * Authentication service for register, login, logout, and session management.
 */

const API_BASE = "/api";

/**
 * Register a new account.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{userId: string, email: string}>}
 */
export async function register(email, password) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Registration failed");
  }

  return res.json();
}

/**
 * Log in with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{userId: string, email: string}>}
 */
export async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Login failed");
  }

  return res.json();
}

/**
 * Log out the current user (clears session).
 * @returns {Promise<void>}
 */
export async function logout() {
  const res = await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Logout failed");
  }
}

/**
 * Get the current user's info (if logged in).
 * @returns {Promise<{userId: string, email: string}|null>}
 */
export async function getMe() {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      credentials: "include",
    });

    // User not logged in (no active session)
    if (res.status === 401) {
      console.log("[getMe] User not logged in (401)");
      return null;
    }

    // Other error responses (500, etc.)
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      console.error(`[getMe] HTTP ${res.status}:`, error.error);
      throw new Error(error.error || `HTTP ${res.status}`);
    }

    // Success - return user info
    const user = await res.json();
    return user;
  } catch (err) {
    console.error("[getMe] Error:", err.message);
    return null;
  }
}

/**
 * Delete the currently logged-in account.
 * @returns {Promise<void>}
 */
export async function deleteAccount() {
  const res = await fetch(`${API_BASE}/auth/account`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Delete account failed");
  }
}
