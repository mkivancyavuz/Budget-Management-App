// The soft accent glow used behind both the auth screens and the app itself,
// kept in one place so the two never drift apart.
//
// Drawn with CSS only (no image, no next/image host config) and coloured from
// the app's own accent token, so it follows the light/dark theme. Ornamental,
// hence aria-hidden and non-interactive.
//
// Sizes step up at xl/2xl: a glow that looks right on a 2560px display is
// overbearing at 1200px, and one tuned for 1200px disappears on a large
// monitor.

/** `auth` sits behind a single centred card, so a blurred disc reads fine —
 * it stays reasonably defined and gives the card something to sit on.
 *
 * `app` sits behind dense dashboards, where that same disc reads as a visible
 * circle. It uses radial gradients instead: they fall off smoothly by their
 * nature, so the light has no discernible edge at all. (Simply raising the
 * blur radius on the disc doesn't help — past ~130px the difference isn't
 * perceptible, because a translucent circle that large is already soft.) */
type Variant = "auth" | "app";

/** color-mix keeps the tint tied to the theme's accent token rather than a
 * hard-coded hex, so light and dark both get a sensible wash. */
function accentWash(percent: number) {
  return `color-mix(in srgb, var(--accent) ${percent}%, transparent)`;
}

export function GlowLayer({
  position = "absolute",
  variant = "auth",
}: {
  position?: "absolute" | "fixed";
  variant?: Variant;
}) {
  const wrapper = `pointer-events-none ${position} inset-0 z-0 overflow-hidden`;

  if (variant === "app") {
    return (
      <div aria-hidden="true" className={wrapper}>
        {/* Broad wash centred a little above the middle, where the dashboard's
            first cards sit. */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(60% 55% at 50% 38%, ${accentWash(20)} 0%, ${accentWash(9)} 45%, transparent 78%)`,
          }}
        />
        {/* Fainter pool along the bottom so the lower half doesn't go flat on a
            long page. */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(70% 45% at 50% 108%, ${accentWash(13)} 0%, ${accentWash(6)} 50%, transparent 80%)`,
          }}
        />
      </div>
    );
  }

  return (
    <div aria-hidden="true" className={wrapper}>
      {/* Main glow, centred so it reads as light rather than as a shape. */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[42rem] h-[42rem] xl:w-[54rem] xl:h-[54rem] 2xl:w-[72rem] 2xl:h-[72rem] rounded-full bg-app-accent/20 blur-[130px] xl:blur-[150px] 2xl:blur-[190px]" />

      {/* Second, fainter glow low on the page so the bottom corners don't go
          flat. */}
      <div className="absolute -bottom-56 left-1/2 -translate-x-1/2 w-[52rem] h-[32rem] xl:w-[68rem] xl:h-[40rem] 2xl:w-[90rem] 2xl:h-[50rem] rounded-full bg-app-accent/10 blur-[120px] xl:blur-[140px] 2xl:blur-[180px]" />
    </div>
  );
}
