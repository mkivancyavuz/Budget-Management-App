import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { LanguageProvider } from "@/lib/i18n";
import { ThemeProvider, themeInitScript } from "@/lib/theme";
import { CurrencyProvider } from "@/lib/currency";
import { AuthProvider } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { TourProvider } from "@/lib/tour/TourProvider";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { AssistantBubble } from "@/components/assistant/AssistantBubble";
import { SiteBackground } from "@/components/SiteBackground";
import { SupabaseSetupNotice } from "@/components/SupabaseSetupNotice";

export const metadata: Metadata = {
  title: "Budget Management",
  description: "Budget based on cash actually in hand, built for irregular freelance income.",
};

// The service-role key is required now too: the sign-in guard and every data
// API route validate sessions against our own `sessions` table using the
// admin client (see lib/serverSession.ts) rather than a client-held Supabase
// JWT, so without it the app has no way to authenticate anyone.
const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the theme-init script below deliberately sets
    // data-theme on <html> before React hydrates, so the server HTML and the
    // client tree differ on that one attribute by design. Without this, React
    // logs a hydration mismatch for it on every load.
    <html lang="tr" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full bg-app-bg text-app-text">
        {/* Runs before hydration so the stored theme (localStorage only, never the URL)
            applies on first paint with no flash of the wrong theme. beforeInteractive
            makes Next inject this safely in <head> instead of a raw <script> tag. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        {!supabaseConfigured ? (
          <SupabaseSetupNotice />
        ) : (
          <ThemeProvider>
            <LanguageProvider>
              <CurrencyProvider>
                <AuthProvider>
                  <StoreProvider>
                    <TourProvider>
                      <SiteBackground />
                      <AppShell>{children}</AppShell>
                      <AssistantBubble />
                      <TourOverlay />
                    </TourProvider>
                  </StoreProvider>
                </AuthProvider>
              </CurrencyProvider>
            </LanguageProvider>
          </ThemeProvider>
        )}
      </body>
    </html>
  );
}
