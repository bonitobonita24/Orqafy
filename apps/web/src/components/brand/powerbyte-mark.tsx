import { cn } from "@/lib/utils";

/**
 * Official Powerbyte IT Solutions logo-only mark (the COMPANY/developer brand —
 * not the Orqafy product mark). Source of truth:
 * Branding-Marketing-Framework/brand-assets/official-logo/160x160pxLogoOnly.png,
 * copied to public/brand/powerbyte/.
 *
 * The plain logo-only mark is a green glyph on a transparent background, so it
 * reads on both the light and dark theme — no dark/light swap needed (the
 * DarkBG/LightBG pair only exists for the full wordmark lockup).
 *
 * The raster (23 KB) is used instead of logoonly.svg because the kit's SVG is a
 * ~650 KB wrapper around an embedded raster — no crispness gain at icon size.
 *
 * Decorative: always rendered next to the "Developed by Powerbyte IT Solutions"
 * link text, which carries the accessible name.
 *
 * Served from /brand — keep "/brand" in PUBLIC_PATHS (src/lib/public-paths.ts)
 * or the auth middleware 307-redirects the image to /login.
 */
export function PowerbyteMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/powerbyte/logo-only-160.png"
      alt=""
      aria-hidden="true"
      width={160}
      height={160}
      className={cn("size-3.5 shrink-0 object-contain", className)}
    />
  );
}
