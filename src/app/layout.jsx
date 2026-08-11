import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import { AppearanceModeProvider } from "@/components/appearance-mode-provider";
import { PWARegister } from "@/components/pwa-register";
import { PWAInstallDialog } from "@/components/pwa-install-dialog";
import { Toaster } from "@/components/ui/sonner";
import { AppLayoutClient } from "@/components/app-layout-client";
import { TrialProvider } from "@/components/trial-provider";
import { TrialGuard } from "@/components/trial-guard";

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#000000',
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
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="antialiased font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
          storageKey="aruna-theme"
        >
          <AuthProvider>
            <TrialProvider>
              <AppearanceModeProvider>
                <PWARegister />
                <PWAInstallDialog />
                <Toaster position="top-center" />
                <TrialGuard>
                  <AppLayoutClient>
                    {children}
                  </AppLayoutClient>
                </TrialGuard>
              </AppearanceModeProvider>
            </TrialProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
