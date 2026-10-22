import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Flatmate TrustVault · TideCloak Emergent Authority",
  description:
    "A multi-party rental bond escrow with server-verified TideCloak sessions, role-scoped API access and field-level encryption.",
  applicationName: "Flatmate TrustVault",
  authors: [{ name: "Flatmate TrustVault" }],
  keywords: [
    "TideCloak",
    "emergent authority",
    "rental bond",
    "escrow",
    "hackathon",
  ],
  openGraph: {
    title: "Flatmate TrustVault",
    description:
      "A $1,200 rental bond that no single person can move. Landlord + 2-of-3 tenant signatures, verified server-side.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
