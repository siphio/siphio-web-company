import type { Metadata } from "next";
import { Plus_Jakarta_Sans, DM_Serif_Display, Inter } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const dmSerif = DM_Serif_Display({
  variable: "--font-accent",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Siphio — Landing Page Builder",
  description: "AI-powered landing page generation with premium shadcn blocks",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${plusJakarta.variable} ${dmSerif.variable} ${inter.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
