// React 19 + Radix UI / Next.js App Router compatibility fix.
// React 19's ReactPortal interface requires `children`, which breaks Radix
// ForwardRef components and async Server Component return types.
// This widens children back to optional. Remove when @radix-ui/* and
// Next.js generated types catch up to React 19's stricter signatures.
// React 19 made ReactPortal.children required, breaking Radix UI ForwardRef
// components and Next.js App Router async page return types (71 errors total).
// Augment the "react" module to widen children back to optional.
// @types/react uses `export = React` (CJS namespace export), so module
// augmentation with `import "react"` targets the correct declaration.
// Remove when @radix-ui/* and Next.js types catch up to React 19 signatures.

import "react";

declare module "react" {
  interface ReactPortal {
    children?: ReactNode;
  }
}

export {};
