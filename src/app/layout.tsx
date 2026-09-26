import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://remotefromapac.vercel.app"),
  title: {
    default: "RemoteFromAPAC — Remote Jobs Aggregator",
    template: "%s — RemoteFromAPAC",
  },
  description:
    "Find remote jobs from multiple job boards in one searchable dashboard. Filter by type, level, category and location.",
  openGraph: {
    type: "website",
    siteName: "RemoteFromAPAC",
    url: "https://remotefromapac.vercel.app",
    title: "RemoteFromAPAC — Remote Jobs Aggregator",
    description:
      "Remote roles you can take from Asia-Pacific, aggregated from multiple job boards and company career pages.",
  },
  twitter: {
    card: "summary_large_image",
    title: "RemoteFromAPAC — Remote Jobs Aggregator",
    description:
      "Remote roles you can take from Asia-Pacific, aggregated from multiple job boards and company career pages.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
