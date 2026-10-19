import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import { registerSW } from 'virtual:pwa-register'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

/**
 * 注册 Service Worker（PWA）
 * autoUpdate 模式：检测到新版本后后台更新，下次进入即为新版，无需用户点确认。
 * 注意：/api/generate 已配置为 NetworkOnly——生图结果不缓存，避免拿到旧图。
 */
registerSW({
  onOfflineReady() {
    console.log('[轻装] 已具备离线访问能力')
  }
})
