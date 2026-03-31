import "./globals.css";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import { PWARegister } from "@/components/pwa-register";
import { PWAInstallDialog } from "@/components/pwa-install-dialog";
import { AppLayoutClient } from "@/components/app-layout-client";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9fafb' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0f' }
  ],
};

export const metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "aruna",
  description: "Smart seasonal charts with election-cycle context",
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/aruna.png', sizes: 'any', type: 'image/png' },
      { url: '/aruna.png', sizes: '32x32', type: 'image/png' },
      { url: '/aruna.png', sizes: '192x192', type: 'image/png' },
      { url: '/aruna.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/aruna.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/aruna.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: process.env.NEXT_PUBLIC_APP_NAME || "aruna",
  },
  applicationName: process.env.NEXT_PUBLIC_APP_NAME || "aruna",
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="antialiased font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <PWARegister />
            <PWAInstallDialog />
            <AppLayoutClient>
              {children}
            </AppLayoutClient>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
