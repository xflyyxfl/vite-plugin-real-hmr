
import { defineConfig } from 'vite'
import jsApp from './vite-plugin-jsApp.js';

// https://vitejs.dev/config/
export default defineConfig({
    base:'./',
  plugins: [
    // react(),
    // vue2HMR(),
    // vue(),
    jsApp({
        isProduction:process.env.NODE_ENV ==='production',
    })
],

  server:{
    hmr:true,
    fs:{
        strict:false,
    }
  },
  build:{
    outDir:"./dist3",
    emptyOutDir:true,
    minify:false,
    sourcemap:true,
  }
})
