import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    sourcemap: true,
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, 'src/index.js'),
      name: 'ScrollTimeline',
      // the proper extensions will be added
      fileName: (format, entryAlias) => `scroll-timeline${format=='iife'?'':'-' + format}.js`,
      formats: ['iife'],
    },
    minify: 'terser',
    terserOptions: {
      keep_classnames: /^((View|Scroll)Timeline)|CSS.*$/
    },
    rollupOptions: {
      output: {
        // Provide global variables to use in the UMD build
        // for externalized deps
        globals: {
        },
      },
    }
  },
})
