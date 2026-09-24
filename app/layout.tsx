import type { Metadata } from "next";
import "./globals.css";
import "./reference.css";
import "./reference-overrides.css";
export const metadata: Metadata = {
  title: {
    default: "Zeudi Di Palma — Portfolio",
    template: "%s — Zeudi Di Palma",
  },
  description: "Selected work, biography and contact.",
  robots:
    process.env.SITE_MODE === "production"
      ? { index: true, follow: true }
      : { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
