import type { Metadata } from "next";
import { Inter, Playfair_Display, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import CustomCursor from "@/components/CustomCursor";
import AudioController from "@/components/AudioController";
import Footer from "@/components/Footer";
import Vignette from "@/components/Vignette";
import Preloader from "@/components/Preloader";
import { IntroProvider } from "@/components/IntroContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Game Gallery",
  description: "A premium 3D showcase for game screenshots.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} ${jetbrains.variable}`}>
        <IntroProvider>
          <Preloader />
          <SmoothScroll />
          <CustomCursor />
          <AudioController />
          <Vignette />
          <div className="layout-wrapper">
            {children}
          </div>
          <Footer />
        </IntroProvider>
      </body>
    </html>
  );
}
