"use client";
import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
export default function Login() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="admin-shell" style={{ maxWidth: 480 }}>
      <p className="eyebrow">ZEUDI DI PALMA / PRIVATE CMS</p>
      <h1>Welcome back.</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          const data = new FormData(e.currentTarget);
          try {
            const result = await authClient.signIn.email({
              email: String(data.get("email")),
              password: String(data.get("password")),
            });
            if (result.error)
              setMessage(result.error.message || "Sign in failed");
            else location.assign("/admin");
          } catch {
            setMessage("Unable to connect. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Email
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <p role="status">{message}</p>
      <Link href="/admin/reset">Forgot your password?</Link>
      <p>Accounts are invitation only.</p>
    </main>
  );
}
