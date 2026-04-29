// pages/api/admin/login.js

import {
  validateAdminCredentials,
  signAdminToken,
  buildSessionCookie,
  buildClearCookie,
  getTokenFromRequest,
  verifyAdminToken,
  isAdminConfigured,
} from "@/lib/auth";

export default async function handler(req, res) {
  // ─── POST /api/admin/login ── Authenticate admin ─────────────────────────
  if (req.method === "POST") {
    if (!isAdminConfigured()) {
      return res.status(500).json({
        success: false,
        error: "Server not configured: ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_JWT_SECRET must be set in environment variables.",
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required" });
    }

    if (!validateAdminCredentials(email, password)) {
      // Intentional delay to prevent brute-force
      await new Promise((r) => setTimeout(r, 800));
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const token = await signAdminToken({ role: "admin", email });
    const cookie = buildSessionCookie(token);

    res.setHeader("Set-Cookie", cookie);
    return res.status(200).json({ success: true, message: "Login successful" });
  }

  // ─── DELETE /api/admin/login ── Logout ────────────────────────────────────
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", buildClearCookie());
    return res.status(200).json({ success: true, message: "Logged out" });
  }

  // ─── GET /api/admin/login ── Check session validity ───────────────────────
  if (req.method === "GET") {
    const token = getTokenFromRequest(req);
    if (!token) return res.status(401).json({ authenticated: false });
    const payload = await verifyAdminToken(token);
    if (!payload) return res.status(401).json({ authenticated: false });
    return res.status(200).json({ authenticated: true, email: payload.email });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
