import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// AP6 ergänzt hier vite-plugin-pwa und den Pfad für GitHub Pages (`base`).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
