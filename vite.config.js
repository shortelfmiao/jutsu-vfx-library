import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  server: {
    cors: true
  },
  input: {
    main: resolve(import.meta.dirname, "index.html"),
    background: resolve(import.meta.dirname, "background.html")
  }
});
