import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 每次构建生成新 SW，自动接管并提示刷新
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: '轻装 · AI 无痕空间改造助手',
        short_name: '轻装',
        description: '面向租房与宿舍青年的 AI 无痕空间改造助手',
        lang: 'zh-CN',
        theme_color: '#12141a',
        background_color: '#12141a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // 生图按张计费，结果必须走网络，不能缓存接口响应
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /\/api\/cache\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'qingzhuang-images',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /\/api\/(generate|health)/i,
            handler: 'NetworkOnly'
          }
        ]
      },
      devOptions: {
        // 开发时不注册 SW，避免热更新被缓存干扰
        enabled: false
      }
    })
  ],
  server: {
    host: true,
    port: 5173,
    // 前端只调自己的 /api，由代理层持有百炼 Key，不在浏览器暴露
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  }
})
