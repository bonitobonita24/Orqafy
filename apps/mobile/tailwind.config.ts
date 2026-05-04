import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#050507",
        foreground: "#E8E8ED",
        primary: "#00d992",
        "primary-foreground": "#050507",
        muted: "#1A1A1F",
        "muted-foreground": "#8E8E93",
        destructive: "#FF453A",
        border: "#2C2C2E",
        card: "#0D0D11",
        accent: "#5E5CE6",
      },
    },
  },
  plugins: [],
} satisfies Config;
