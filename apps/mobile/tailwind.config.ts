import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Canonical theme: shadcn neutral-dark — mirrors src/constants/colors.ts
      // (kept as a second source only because NativeWind reads Tailwind config
      // statically; see that file for the HSL→hex derivation).
      colors: {
        background: "#0a0a0a",
        foreground: "#fafafa",
        primary: "#fafafa",
        "primary-foreground": "#171717",
        muted: "#262626",
        "muted-foreground": "#a3a3a3",
        destructive: "#7f1d1d",
        border: "#262626",
        card: "#0a0a0a",
        accent: "#262626",
      },
    },
  },
  plugins: [],
} satisfies Config;
