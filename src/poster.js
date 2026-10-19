/**
 * 分享海报生成（原生 Canvas，无第三方依赖）
 * 输出：竖版 750×1460 逻辑像素，按 scale=2 渲染，保证高分屏清晰
 *
 * 注意：百炼生成的图 URL 仅 24h 有效，本项目已在代理层把图缓存到本地
 * （/api/cache/xxx.jpg，同源），因此可直接绘制，不受 CORS 与过期影响。
 */

import { styleFull } from './stylePresets.js'

const W = 750
const H = 1460
const PAD = 40

const C = {
  bg: '#0f1116',
  card: '#171a21',
  text: '#e8eaef',
  muted: '#9aa3b2',
  accent: '#f5a76c',
  ok: '#4ade80',
  warn: '#fbbf24',
  line: '#262b35'
}

const FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif'
const f = (size, weight = 400) => `${weight} ${size}px ${FONT}`

const loadImg = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// 等比裁剪填满（cover）
function drawCover(ctx, img, x, y, w, h) {
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
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

function clipText(ctx, text, maxW) {
  let t = String(text ?? '')
  if (ctx.measureText(t).width <= maxW) return t
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

function drawImageBox(ctx, img, x, y, w, h, label) {
  ctx.save()
  roundRect(ctx, x, y, w, h, 16)
  ctx.clip()
  ctx.fillStyle = '#1f232c'
  ctx.fillRect(x, y, w, h)
  if (img) drawCover(ctx, img, x, y, w, h)
  ctx.restore()

  ctx.textAlign = 'center'
  ctx.font = f(24)
  ctx.fillStyle = C.muted
  ctx.fillText(label, x + w / 2, y + h + 38)
  ctx.textAlign = 'left'
}

export async function buildPoster(result) {
  const { before, after, room, list = [], style } = result

  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)

  // 背景
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, W, H)

  // 标题区
  ctx.fillStyle = C.accent
  ctx.font = f(54, 500)
  ctx.fillText('轻装', PAD, 84)
  ctx.fillStyle = C.muted
  ctx.font = f(24)
  ctx.fillText('租房也能放心改、退租能完整复原', PAD, 122)

  // 分隔线
  ctx.strokeStyle = C.line
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD, 146)
  ctx.lineTo(W - PAD, 146)
  ctx.stroke()

  // 加载图
  const [ib, ia] = await Promise.all([
    before ? loadImg(before).catch(() => null) : Promise.resolve(null),
    after ? loadImg(after).catch(() => null) : Promise.resolve(null)
  ])

  // before / after
  const iy = 172
  const ih = 420
  const gap = 14
  const iw = (W - PAD * 2 - gap) / 2
  drawImageBox(ctx, ib, PAD, iy, iw, ih, '原房间')
  drawImageBox(ctx, ia, PAD + iw + gap, iy, iw, ih, '改造后')

  // 信息行
  const infoY = iy + ih + 86
  ctx.font = f(26)
  ctx.fillStyle = C.text
  const sizeTxt =
    room && room.length_m && room.width_m ? `约 ${room.length_m} × ${room.width_m} m` : '尺寸待估算'
  ctx.fillText(`${styleFull(style) || '自定义'} · ${room?.type || '房间'} · ${sizeTxt}`, PAD, infoY)

  // 清单（最多 5 条，保证一屏放得下）
  const items = list.slice(0, 5)
  let y = infoY + 56
  for (const it of items) {
    ctx.font = f(26)
    ctx.fillStyle = C.text
    ctx.fillText(clipText(ctx, it.name, 400), PAD, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = C.accent
    ctx.fillText(`¥${it.price}`, W - PAD, y)
    ctx.textAlign = 'left'
    ctx.font = f(19)
    ctx.fillStyle = it.restorable ? C.ok : C.warn
    ctx.fillText(it.restorable ? '✓ 无痕可复原' : '△ 需注意', PAD, y + 28)
    y += 70
  }

  // 预算
  const total = list.reduce((s, it) => s + (Number(it.price) || 0), 0)
  ctx.fillStyle = C.muted
  ctx.font = f(26)
  ctx.fillText('预算合计', PAD, y + 18)
  ctx.fillStyle = C.accent
  ctx.font = f(46, 500)
  ctx.fillText(`¥${total}`, PAD + 152, y + 22)

  // 页脚
  ctx.fillStyle = C.muted
  ctx.font = f(21)
  ctx.fillText('拍一张房间照，选一个风格，AI 帮你改造到能还原。', PAD, H - 96)
  ctx.fillText('效果图由 AI 辅助生成，仅作方案示意。', PAD, H - 62)

  return canvas.toDataURL('image/jpeg', 0.92)
}
