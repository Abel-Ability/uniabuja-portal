import type { Metadata } from "next";
import { Jost, Roboto } from "next/font/google";
import "./globals.css";
import { ConsentBanner } from "@/components/consent-banner";

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "University of Abuja (Yakubu Gowon University) — Unified Portal",
    template: "%s | UniAbuja Portal",
  },
  description:
    "The unified academic and administrative portal of the University of Abuja (Yakubu Gowon University) — The University for National Unity.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jost.variable} ${roboto.variable}`} suppressHydrationWarning>
      <head>
      </head>
      <body className="min-h-dvh flex flex-col antialiased">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
        <ConsentBanner />
      </body>
    </html>
  );
}
