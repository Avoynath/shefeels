import { defineConfig } from 'vite'
import fs from 'fs'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import compression from 'vite-plugin-compression'
import type { ServerOptions } from 'https'

// --- Compute HTTPS configuration BEFORE defineConfig ---
const httpsConfig: ServerOptions | true | undefined = (() => {
  try {
    const useHttps = process.env.VITE_HTTPS === 'true'
    if (!useHttps) return undefined

    const keyPath = process.env.VITE_HTTPS_KEY || './certs/localhost-key.pem'
    const certPath = process.env.VITE_HTTPS_CERT || './certs/localhost.pem'

    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      return {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      }
    }

    // ✅ Let Vite auto-generate a self-signed certificate
    console.warn('vite: no cert files found, will auto-generate a self-signed certificate')
    return true
  } catch (e) {
    console.warn('vite: failed to configure https for dev server, falling back to http', e)
    return undefined
  }
})()

// --- Main Vite config ---
export default defineConfig({
  base: '/', // Use absolute root so deep links like /chat/... can reload correctly

  plugins: [
    react(),
    tailwindcss(),
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 5120,
    }),
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 5120,
    }),
  ],

  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,

    // ✅ Cast to any to allow 'true' or ServerOptions
    https: httpsConfig as any,

    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000', // local backend
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },

  build: {
    minify: 'terser',
    sourcemap: false,

    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.trace'],
        passes: 1,
        inline: 1,
        reduce_funcs: false,
        reduce_vars: false,
        hoist_vars: false,
        hoist_funs: false,
        toplevel: false,
      },
      mangle: {
        safari10: true,
        keep_classnames: true,
        keep_fnames: true,
      },
      format: {
        comments: false,
      },
      toplevel: false,
    },

    assetsDir: 'assets',

    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router')) return 'router'
            // Split admin bundle separately for lazy loading
            if (id.includes('/admin/')) return 'admin'
            if (id.includes('lucide-react')) return 'icons-lucide'
            if (id.includes('react-icons')) return 'icons-react'
            if (id.includes('axios')) return 'http'
            if (id.includes('echarts')) return 'charts'
            if (id.includes('recharts')) return 'charts'
            // Remove MUI chunk since we're migrating away
            return 'vendor'
          }
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: ({ name }) => {
          if (/\.(png|jpe?g|gif|svg|webp|ico|avif)$/.test(name ?? ''))
            return 'assets/images/[name]-[hash][extname]'
          if (/\.(woff2?|eot|ttf|otf)$/.test(name ?? ''))
            return 'assets/fonts/[name]-[hash][extname]'
          return 'assets/[name]-[hash][extname]'
        },
      },
    },

    chunkSizeWarningLimit: 800,
    cssCodeSplit: true,
    cssMinify: true,
    assetsInlineLimit: 4096,
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios'],
    exclude: ['lucide-react'],
    esbuildOptions: {
      target: 'es2020',
    },
  },

  esbuild: {
    drop: ['console'],
    legalComments: 'none',
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
  },
})
