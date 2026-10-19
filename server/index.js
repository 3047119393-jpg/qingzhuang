import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import {
  isMock,
  generateImage,
  recognizeRoom,
  generateRenovation,
  MODEL_IMAGE,
  estimateSec,
  MODEL_OPTIONS,
  DEFAULT_QUALITY,
  pickModel,
  qualityInfo
} from './bailian.js'

// 必须显式指定 server/.env：进程在根目录启动时，默认不会去找子目录的 .env
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })
dotenv.config() // 再兜底读一次根目录 .env（若有）

// 结果缓存：生图按张计费（¥0.5/张），同一张图+同一风格重复请求不再烧额度
const CACHE_DIR = path.join(__dirname, '_cache')
fs.mkdirSync(CACHE_DIR, { recursive: true })

const app = express()
app.use(cors())
app.use(express.json({ limit: '20mb' }))
// 缓存的图存本地并提供 http 访问（百炼生成的 URL 只有 24h 有效期）
app.use('/api/cache', express.static(CACHE_DIR))

// 带上当前生图模型与预计耗时：前端据此显示倒计时，避免几十秒的等待看起来像卡死
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    mock: isMock(),
    model_image: MODEL_IMAGE,
    estimate_sec: estimateSec(MODEL_IMAGE),
    // 出图质量档位（前端据此渲染选择器，模型名与耗时都由服务端下发）
    quality_options: MODEL_OPTIONS,
    default_quality: DEFAULT_QUALITY,
    ts: Date.now()
  })
})

/**
 * 下载百炼结果图到本地缓存，带完整校验：
 *  - HTTP 200 且 content-type 为 image/*
 *  - 内容魔数必须是 JPEG(FFD8) 或 PNG(8950)，且 > 10KB
 *  - 失败自动重试一次（OSS 偶发抖动）
 *  - 按真实内容决定扩展名（百炼可能返回 PNG，存成 .jpg 会导致 content-type 错误）
 * 校验不过一律视为失败（返回 null），绝不把错误内容写进缓存。
 * @returns {string|null} 成功返回最终文件名，失败返回 null
 */
async function downloadToCache(url, cacheDir, key) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(30000) })
      const ct = r.headers.get('content-type') || ''
      const buf = Buffer.from(await r.arrayBuffer())
      const isJpeg = buf[0] === 0xff && buf[1] === 0xd8
      const isPng = buf[0] === 0x89 && buf[1] === 0x50
      if (r.ok && ct.startsWith('image/') && buf.length > 10 * 1024 && (isJpeg || isPng)) {
        const ext = isPng ? '.png' : '.jpg'
        const fname = key + ext
        fs.writeFileSync(path.join(cacheDir, fname), buf)
        return fname
      }
      console.warn(`[cache] 第${attempt}次下载校验失败: status=${r.status} ct=${ct} size=${buf.length} jpeg=${isJpeg} png=${isPng}`)
    } catch (e) {
      console.warn(`[cache] 第${attempt}次下载异常:`, e.message)
    }
    if (attempt < 2) await new Promise((ok) => setTimeout(ok, 3000))
  }
  return null
}

/**
 * 一次请求完成：识别空间 -> 按清单规则库生成无痕改造清单 -> AI 生改造效果图
 * 前端只传 { image(base64), style }
 */
app.post('/api/generate', async (req, res) => {
  try {
    const { image, style } = req.body || {}
    if (!image) return res.status(400).json({ ok: false, error: '缺少图片' })
    if (!style) return res.status(400).json({ ok: false, error: '缺少风格' })
    const clean = req.body.clean !== false // 画面清理：默认开
    // 出图质量档位（fast/fine），决定用哪个生图模型
    const quality = qualityInfo(req.body.quality) ? req.body.quality : DEFAULT_QUALITY

    // 缓存 key 必须带上 clean 与 quality：否则用户切换开关/档位会命中旧缓存，看着像"没生效"
    const cacheKey = crypto
      .createHash('md5')
      .update(image + '|' + style + '|' + (clean ? 'clean' : 'raw') + '|' + quality)
      .digest('hex')
      .slice(0, 16)
    const metaFile = path.join(CACHE_DIR, `${cacheKey}.json`)

    // 命中缓存：直接返回，零调用零花费
    // （meta 里记了真实文件名，图文件必须真实存在才算命中——防止坏缓存）
    if (fs.existsSync(metaFile)) {
      try {
        const cached = JSON.parse(fs.readFileSync(metaFile, 'utf8'))
        const cachedImg = path.join(CACHE_DIR, path.basename(cached.after || ''))
        if (cached.after && fs.existsSync(cachedImg) && fs.statSync(cachedImg).size > 1024) {
          console.log('[generate] 命中缓存，跳过 API 调用 key=' + cacheKey)
          return res.json({ ...cached, before: image, cached: true })
        }
        console.warn('[generate] 缓存 meta 存在但图文件缺失/损坏，重新生成 key=' + cacheKey)
      } catch { /* meta 损坏也走重新生成 */ }
    }

    // 先识别一次（视觉模型按 token 计费，不重复调用），再并行生图与出清单
    const room = await recognizeRoom(image)
    const [imageRes, list] = await Promise.all([
      generateImage(image, style, { clean, quality }),
      generateRenovation(room, style)
    ])

    const payload = {
      ok: true,
      mock: !!imageRes.mock,
      after: imageRes.url,
      room,
      list,
      clean,
      quality,
      model: pickModel(quality),
      estimate: estimateSec(pickModel(quality))
    }

    // 真实生成成功才缓存：把图存本地，避免 24h 后 URL 失效
    if (!imageRes.mock && imageRes.url?.startsWith('http')) {
      const fname = await downloadToCache(imageRes.url, CACHE_DIR, cacheKey)
      if (fname) {
        const localUrl = `/api/cache/${fname}`
        payload.after = localUrl
        fs.writeFileSync(
          metaFile,
          JSON.stringify({ ok: true, mock: false, after: localUrl, room, list, clean, quality, model: payload.model, estimate: payload.estimate })
        )
        console.log('[generate] 已写入缓存 key=' + cacheKey)
      } else {
        // 下载失败：不污染缓存，直接把百炼原始 URL 给前端（24h 内有效），
        // 下次同图同风格请求会重新尝试下载，而不是永远命中坏缓存
        console.warn('[generate] 结果图下载校验失败，回退为百炼原始 URL')
      }
    }

    res.json({ ...payload, before: image })
  } catch (e) {
    console.error('[generate]', e)
    res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
})

/* ---------- 生产环境：同一个端口同时提供前端页面与 API（单端口部署） ---------- */
// 云端部署时只有 1 个公开端口，所以这里直接托管前端产物，
// 浏览器访问 / 拿页面，访问 /api/* 走接口，Key 依然只在服务端。
//
// 目录优先级：webroot/ > dist/
//   webroot/ = 预先构建好并随包上传的目录（云函数/容器无构建时间时用这个，启动最快）
//   dist/    = 本地 npm run build 的默认输出
const DIST_CANDIDATES = [path.join(__dirname, '..', 'webroot'), path.join(__dirname, '..', 'dist')]
const DIST = DIST_CANDIDATES.find((p) => fs.existsSync(path.join(p, 'index.html'))) || DIST_CANDIDATES[0]
if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.warn(`[轻装] 警告：未找到前端产物（${DIST}），页面可能打不开，请先执行 npm run build`)
}
app.use(express.static(DIST))
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'), (err) => {
    if (err) res.status(404).send('Not Found')
  })
})

// 必须监听平台注入的 PORT 并绑定 0.0.0.0，否则外网访问不到
const PORT = process.env.PORT || 8787
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[轻装] 服务已启动 http://0.0.0.0:${PORT}`)
  console.log(`[轻装] 模式：${isMock() ? '演示(mock)，未读到可用的 API Key' : '真实调用百炼'}`)
})
