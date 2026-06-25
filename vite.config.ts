import { defineConfig } from "vite";

export default defineConfig({
  base: "/push_swap_visualizer/",
  test: {
    globals: true,
    environment: "node",
    passWithNoTests: true,
  },
});
