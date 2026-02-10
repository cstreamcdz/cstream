import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 5000,
    strictPort: true,
    allowedHosts: true,
    cors: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'use-sync-external-store', 'zustand', 'framer-motion', 'lucide-react'],
    exclude: ['zustand/middleware', '@tanstack/react-query'],
    esbuildOptions: {
      target: 'esnext',
      supported: { bigint: true },
    }
  },
  build: {
    outDir: "dist",
    sourcemap: mode === "development",
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    cssCodeSplit: true,
    reportCompressedSize: false,
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Group heavy foundational libraries together
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-core';
            }
            // Group UI/Utility libs
            if (id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('framer-motion')) {
              return 'vendor-ui';
            }
            // Let everything else (including Recharts) be handled by Vite's auto-splitting
          }
        },
      },
    },
    chunkSizeWarningLimit: 2000,
  },
  esbuild: {
    legalComments: 'none',
    treeShaking: true,
  },
  preview: {
    port: 5000,
    host: '0.0.0.0',
  },
}));
