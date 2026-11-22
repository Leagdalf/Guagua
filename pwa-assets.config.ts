import { defineConfig } from "@vite-pwa/assets-generator/config";

// Erzeugt die PNG-Symbole aus public/icon.svg (npm run icons). Das Quadrat ist deckend und der Berg
// liegt innerhalb der Schutzzone, deshalb braucht keine Größe Rand (padding 0), auch die maskierbare nicht.
export default defineConfig({
  preset: {
    transparent: { sizes: [192, 512], padding: 0 },
    maskable: { sizes: [512], padding: 0 },
    apple: { sizes: [180], padding: 0 },
  },
  images: ["public/icon.svg"],
});
