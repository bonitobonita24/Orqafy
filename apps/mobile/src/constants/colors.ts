// Canonical theme: shadcn neutral-dark (fleet-wide reskin — matches
// apps/web/src/app/globals.css :root). Hex values are the direct HSL→hex
// conversion of the web app's CSS custom properties (achromatic 0% saturation
// → round(L*255); destructive is the one chromatic token, HSL(0,62.8%,30.6%)
// → #7f1d1d). Previous VoltAgent emerald palette archived in
// docs/archive/DESIGN-linear-sunset.md (web-side reference).
export const colors = {
  background: "#0a0a0a", // --background: 0 0% 3.9%
  foreground: "#fafafa", // --foreground: 0 0% 98%
  primary: "#fafafa", // --primary: 0 0% 98%
  primaryForeground: "#171717", // --primary-foreground: 0 0% 9%
  muted: "#262626", // --muted: 0 0% 14.9%
  mutedForeground: "#a3a3a3", // --muted-foreground: 0 0% 63.9%
  destructive: "#7f1d1d", // --destructive: 0 62.8% 30.6%
  border: "#262626", // --border: 0 0% 14.9%
  card: "#0a0a0a", // --card: 0 0% 3.9%
  accent: "#262626", // --accent: 0 0% 14.9%
  // Semantic status accents — not part of the shadcn CSS-variable set on web
  // (unreferenced anywhere in apps/mobile as of this resync); left unchanged.
  success: "#30D158",
  warning: "#FFD60A",
} as const;
