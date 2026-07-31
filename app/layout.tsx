import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { LanguageProvider } from "@/lib/i18n";
import { ThemeProvider, themeInitScript } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import { SupabaseSetupNotice } from "@/components/SupabaseSetupNotice";

export const metadata: Metadata = {
  title: "Freelance Cash Flow",
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
              <AuthProvider>
                <StoreProvider>
                  <div className="flex min-h-screen w-full gap-3 p-3">
                    <Sidebar />
                    <main className="flex-1 min-w-0 flex flex-col">
                      <MobileNav />
                      <div className="flex-1 w-full max-w-[1800px] mx-auto px-1 sm:px-2 py-2">{children}</div>
                      <Footer />
                    </main>
                  </div>
                </StoreProvider>
              </AuthProvider>
            </LanguageProvider>
          </ThemeProvider>
        )}
      </body>
    </html>
  );
}
