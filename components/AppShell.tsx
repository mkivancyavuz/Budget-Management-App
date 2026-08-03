"use client";

// Wraps signed-in pages in the app chrome: sidebar, mobile header, the centred
// max-width content column, and the footer.
//
// Standalone pages (sign in, password reset) get none of it — they're rendered
// as-is, full width. That matters beyond hiding the sidebar: the content column
// is `max-w-[1800px] mx-auto`, so on a 2560px display it becomes a centred
// 1800px band. Anything the auth page pins to its own top-right corner would
// land ~380px in from the edge of the screen rather than in the actual corner.
import { usePathname } from "next/navigation";
import { isStandaloneRoute } from "@/lib/routes";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { Footer } from "./Footer";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isStandaloneRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    // relative z-10: the glow layer behind is positioned at z-0, and positioned
    // elements paint over non-positioned in-flow blocks — without this the
    // backdrop would cover the app.
    <div className="relative z-10 flex min-h-screen w-full gap-3 p-3">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <MobileNav />
        <div className="flex-1 w-full max-w-[1800px] mx-auto px-1 sm:px-2 py-2">{children}</div>
        <Footer />
      </main>
    </div>
  );
}
