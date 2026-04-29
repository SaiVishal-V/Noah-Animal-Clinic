// lib/auth.js
// JWT-based admin session using jose (edge-compatible)

import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || "noah-clinic-secret-change-me"
);

const COOKIE_NAME = "noah_admin_session";
const TOKEN_EXPIRY = "8h";

/**
 * Sign a JWT token for admin session
 */
export async function signAdminToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(SECRET);
}

/**
 * Verify a JWT token
 * Returns payload or null
 */
export async function verifyAdminToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract token from request cookies
 */
export function getTokenFromRequest(req) {
  const cookieHeader = req.headers.cookie || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    })
  );
  return cookies[COOKIE_NAME] || null;
}

/**
 * Build Set-Cookie header string
 */
export function buildSessionCookie(token) {
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=28800${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

/**
 * Build logout cookie (expires immediately)
 */
export function buildClearCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`;
}

/**
 * Validate admin credentials from env vars
 */
export function validateAdminCredentials(email, password) {
  return (
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD
  );
}
