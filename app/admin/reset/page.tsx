"use client";
import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
export default function Reset() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="admin-shell" style={{ maxWidth: 480 }}>
      <h1>Password recovery</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          const token = new URL(location.href).searchParams.get("token");
          try {
            const result = token
              ? await authClient.resetPassword({
                  newPassword: String(f.get("password")),
                  token,
                })
              : await authClient.requestPasswordReset({
                  email: String(f.get("email")),
                  redirectTo: `${location.origin}/admin/reset`,
                });
            setMessage(
              result.error?.message ||
                (token
                  ? "Password updated. You can sign in."
                  : "If this account exists, a recovery email will arrive shortly."),
            );
          } catch {
            setMessage("Recovery is unavailable. Contact the site owner.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Email
          <input name="email" type="email" autoComplete="email" />
        </label>
        <label>
          New password (when opening a recovery link)
          <input
            name="password"
            type="password"
            minLength={12}
            autoComplete="new-password"
          />
        </label>
        <button disabled={busy}>Continue</button>
      </form>
      <p role="status">{message}</p>
      <Link href="/admin/login">Back to sign in</Link>
    </main>
  );
}
