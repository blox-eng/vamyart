import type { Config } from "tailwindcss";
import preset from "@vamy/ui/tailwind-preset";

export default {
  presets: [preset],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
} satisfies Config;
