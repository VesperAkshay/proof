import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--color-paper)",
        ink: "var(--color-ink)",
        "warm-gray": "var(--color-warm-gray)",
        cobalt: "var(--color-cobalt)",
        vermilion: "var(--color-vermilion)",
        marigold: "var(--color-marigold)",
        forest: "var(--color-forest)",
        bg: "var(--color-bg)",
        fg: "var(--color-fg)",
        rule: "var(--color-rule)",
        "rule-soft": "var(--color-rule-soft)",
        action: "var(--color-action)",
        danger: "var(--color-danger)",
        success: "var(--color-success)",
        focus: "var(--color-focus)",
      },
      fontFamily: {
        display: "var(--font-display)",
        body: "var(--font-body)",
        mono: "var(--font-mono)",
      },
      borderRadius: {
        none: "var(--radius-0)",
        sm: "var(--radius-1)",
        DEFAULT: "var(--radius-1)",
      },
      boxShadow: {
        hard: "var(--shadow-hard)",
      },
      maxWidth: {
        grid: "var(--grid-max)",
      },
    },
  },
  plugins: [],
};

export default config;
