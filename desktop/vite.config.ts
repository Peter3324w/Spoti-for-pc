import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  server: {
    host: "0.0.0.0", port: 5173, strictPort: true,
    watch: { ignored: ["**/backend/**", "**/runtime/**", "**/release/**", "**/test-results/**"] }
  },
});
