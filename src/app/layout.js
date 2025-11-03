import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { PWARegister } from "@/components/pwa-register";
import { PWAInstallDialog } from "@/components/pwa-install-dialog";
import { RefreshCcwDot } from "lucide-react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#121212' }
  ],
};

export const metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "Aruna",
  description: "Hirsch-style seasonal profile with election-cycle overlays",
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/aruna.webp', sizes: 'any', type: 'image/png' },
      { url: '/aruna.webp', sizes: '32x32', type: 'image/png' },
      { url: '/aruna.webp', sizes: '192x192', type: 'image/png' },
      { url: '/aruna.webp', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/aruna.webp', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/aruna.webp',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: process.env.NEXT_PUBLIC_APP_NAME || "Aruna",
  },
  applicationName: process.env.NEXT_PUBLIC_APP_NAME || "Aruna",
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PWARegister />
          <PWAInstallDialog />
          <div className="flex flex-col min-h-screen">
            <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
              <div className="mx-auto max-w-[768px] flex h-14 items-center justify-center px-4">
                <div className="flex gap-2">
                  <RefreshCcwDot className="size-6 fill-current text-emerald-600" />
                  <h1 className="text-lg font-bold">{process.env.NEXT_PUBLIC_APP_NAME || "Aruna"}</h1>
                </div>
              </div>
            </header>
            <main className="flex-1 pb-20">
              <div className="mx-auto max-w-[768px] p-4">
                {children}
              </div>
            </main>
            <MobileBottomNav />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
