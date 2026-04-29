// pages/admin/index.js  –  Admin login page
import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import styles from "@/styles/AdminLogin.module.css";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      router.push("/admin/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Admin Login – Noah Animal Clinic</title>
        <meta name="robots" content="noindex,nofollow" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>🐾</div>
            <h1>Noah Animal Clinic</h1>
            <p>Doctor & Staff Portal</p>
          </div>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <span className={styles.badge}>🔒 Secure Admin Access</span>
          </div>
          {error && <div className={styles.errorBox}>⚠️ {error}</div>}
          <form onSubmit={handleLogin}>
            <div className={styles.formGroup}>
              <label>Email Address</label>
              <input
                type="email"
                placeholder="admin@noahclinic.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </form>
          <div className={styles.backLink}>
            <a href="/">← Back to clinic website</a>
          </div>
        </div>
      </div>
    </>
  );
}
