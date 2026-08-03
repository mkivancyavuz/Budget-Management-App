/** Pages that stand on their own, outside the signed-in app: they render as a
 * full-screen card with no sidebar, mobile header or footer around them.
 *
 * Anyone reaching these either has no session yet (sign in / sign up) or is
 * following a one-off link from an email (password recovery), so the app shell
 * — which shows their avatar and navigation — would be both useless and
 * misleading there. */
const STANDALONE_ROUTES = ["/login", "/reset-password"];

export function isStandaloneRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return STANDALONE_ROUTES.some((route) => pathname.startsWith(route));
}
