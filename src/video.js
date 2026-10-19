/**
 * 短视频导出：把 before → after 的过渡过程用 Canvas 录制成视频
 *
 * 实现：canvas.captureStream() + MediaRecorder
 * 说明：
 *  - Chrome / Edge / 新版 Android 浏览器：可导出 WebM（部分新版支持 MP4）
 *  - iOS Safari：MediaRecorder 支持有限，失败时前端会给出降级提示（改用海报分享）
 *  - 录制时长 = duration，画面自带轻微推近（Ken Burns）避免死板
 */

import { styleFull } from './stylePresets.js'

const loadImgSafe = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })

function coverRect(ctx, img, x, y, w, h, zoom = 1) {
  const ir = (img.width || 1) / (img.height || 1)
  const br = w / h
  let sx = 0
  let sy = 0
  let sw = img.width
  let sh = img.height
  if (ir > br) {
    sw = img.height * br
    sx = (img.width - sw) / 2
  } else {
    sh = img.width / br
    sy = (img.height - sh) / 2
  }
  // zoom：从中心放大
  const zw = sw / zoom
  const zh = sh / zoom
  ctx.drawImage(img, sx + (sw - zw) / 2, sy + (sh - zh) / 2, zw, zh, x, y, w, h)
}

function pickMime() {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ]
  for (const m of candidates) {
    if (window.MediaRecorder?.isTypeSupported?.(m)) return m
  }
  return ''
}

export async function exportVideo(result, { duration = 5000, fps = 30 } = {}) {
  const { before, after, style } = result

  if (typeof window.MediaRecorder === 'undefined') {
    throw new Error('当前浏览器不支持视频导出，请改用「生成分享海报」')
  }
  const mimeType = pickMime()
  if (!mimeType) throw new Error('当前浏览器不支持可用的视频编码，请改用海报分享')

  const [ib, ia] = await Promise.all([
    before ? loadImgSafe(before).catch(() => null) : Promise.resolve(null),
    after ? loadImgSafe(after).catch(() => null) : Promise.resolve(null)
  ])
  if (!ib && !ia) throw new Error('缺少可展示的图片')

  const W = 720
  const H = 1280
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  const stream = canvas.captureStream(fps)
  const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 })
  const chunks = []
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data)
  }
  const stopped = new Promise((res) => {
    rec.onstop = res
  })

  const t0 = performance.now()
  rec.start()

  await new Promise((resolve) => {
    function frame(now) {
      const p = Math.min(1, (now - t0) / duration)
      drawFrame(ctx, ib, ia, p, { W, H, style })
      if (p < 1) requestAnimationFrame(frame)
      else resolve()
    }
    requestAnimationFrame(frame)
  })

  rec.stop()
  await stopped
  return new Blob(chunks, { type: mimeType })
}

function drawFrame(ctx, ib, ia, p, { W, H, style }) {
  const fadeStart = 0.32
  const fadeEnd = 0.68
  const a = Math.max(0, Math.min(1, (p - fadeStart) / (fadeEnd - fadeStart)))
  const zoom = 1 + 0.06 * p


  ctx.fillStyle = '#0f1116'
  ctx.fillRect(0, 0, W, H)

  const imgH = H * 0.78
  const imgY = H * 0.1

  if (ib) {
    ctx.save()
    ctx.globalAlpha = 1
    coverRect(ctx, ib, 0, imgY, W, imgH, zoom)
    ctx.restore()
  }
  if (ia) {
    ctx.save()
    ctx.globalAlpha = a
    coverRect(ctx, ia, 0, imgY, W, imgH, zoom)
    ctx.restore()
  }

  // 角标
  ctx.fillStyle = '#e8eaef'
  ctx.font = '500 46px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('轻装', 44, 96)

  ctx.font = '400 26px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillStyle = '#9aa3b2'
  ctx.fillText(`${styleFull(style) || '自定义'} · 无痕可复原改造`, 44, 136)

  // 底部说明
  ctx.textAlign = 'center'
  ctx.font = '400 23px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillStyle = '#9aa3b2'
  ctx.fillText(a > 0.5 ? '改造后' : '原房间', W / 2, H - 46)
  ctx.textAlign = 'left'
}
