import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { config } from "@/lib/config";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { ErrorReporter } from "@/components/error-reporter";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(config.appUrl),
  title: {
    default: "GuestSnap — every guest's photos, one QR code",
    template: "%s · GuestSnap",
  },
  description:
    "Collect photos and videos from every guest at your wedding or event with a QR code. No app, no accounts — guests upload straight from their phone.",
};

export const viewport: Viewport = {
  themeColor: "#FAF8F5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-screen">
        <AnalyticsProvider>
          <ErrorReporter />
          {children}
        </AnalyticsProvider>
      </body>
    </html>
  );
}
