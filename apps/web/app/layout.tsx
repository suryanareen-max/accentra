import type { Metadata } from "next";
import "./globals.css";
import "@neondatabase/auth-ui/css";
import { AuthProvider } from "./providers";

export const metadata: Metadata = {
  title: "Accentra AI",
  description: "Document-to-AutoCount accounting automation with a human review gate.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
