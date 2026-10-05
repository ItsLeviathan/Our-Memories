import type { Metadata, Viewport } from "next";
import { Dancing_Script, Fredoka, Nunito } from "next/font/google";
import { FloatingHearts } from "@/components/ui/FloatingHearts";
import { MotionProvider } from "@/components/ui/MotionProvider";
import "./globals.css";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });
const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"] });
const dancingScript = Dancing_Script({ variable: "--font-dancing-script", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Our Memories", template: "%s · Our Memories" },
  description: "A private place for our memories.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f8f5ff",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${nunito.variable} ${fredoka.variable} ${dancingScript.variable}`}>
      <body className="min-h-dvh">
        <FloatingHearts />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
