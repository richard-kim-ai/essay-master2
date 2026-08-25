declare module "rollup-plugin-visualizer" {
  import type { Plugin } from "vite";

  export function visualizer(options?: {
    filename?: string;
    template?: string;
    gzipSize?: boolean;
    brotliSize?: boolean;
    open?: boolean;
  }): Plugin;
}
