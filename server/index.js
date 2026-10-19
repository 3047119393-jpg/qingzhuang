import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { isMock, generateImage, recognizeRoom, generateRenovation } from './bailian.js'

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

app.get('/api/health', (req, res) => {
  res.json({ ok: true, mock: isMock(), ts: Date.now() })
})

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

    // 缓存 key 必须带上 clean：否则用户切换开关会命中旧缓存，看着像"没生效"
    const cacheKey = crypto
      .createHash('md5')
      .update(image + '|' + style + '|' + (clean ? 'clean' : 'raw'))
      .digest('hex')
      .slice(0, 16)
    const metaFile = path.join(CACHE_DIR, `${cacheKey}.json`)
    const imgFile = path.join(CACHE_DIR, `${cacheKey}.jpg`)

    // 命中缓存：直接返回，零调用零花费
    if (fs.existsSync(metaFile) && fs.existsSync(imgFile)) {
      const cached = JSON.parse(fs.readFileSync(metaFile, 'utf8'))
      console.log('[generate] 命中缓存，跳过 API 调用 key=' + cacheKey)
      return res.json({ ...cached, before: image, cached: true })
    }

    // 先识别一次（视觉模型按 token 计费，不重复调用），再并行生图与出清单
    const room = await recognizeRoom(image)
    const [imageRes, list] = await Promise.all([
      generateImage(image, style, { clean }),
      generateRenovation(room, style)
    ])

    const payload = {
      ok: true,
      mock: !!imageRes.mock,
      after: imageRes.url,
      room,
      list,
      clean
    }

    // 真实生成成功才缓存：把图存本地，避免 24h 后 URL 失效
    if (!imageRes.mock && imageRes.url?.startsWith('http')) {
      try {
        const r = await fetch(imageRes.url)
        fs.writeFileSync(imgFile, Buffer.from(await r.arrayBuffer()))
        const localUrl = `/api/cache/${cacheKey}.jpg`
        payload.after = localUrl
        fs.writeFileSync(metaFile, JSON.stringify({ ok: true, mock: false, after: localUrl, room, list }))
        console.log('[generate] 已写入缓存 key=' + cacheKey)
      } catch (e) {
        console.warn('[generate] 缓存图片失败（不影响结果）:', e.message)
      }
    }

    res.json({ ...payload, before: image })
  } catch (e) {
    console.error('[generate]', e)
    res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
})

const PORT = process.env.PORT || 8787
app.listen(PORT, () => {
  console.log(`[轻装] 代理层已启动 http://localhost:${PORT}`)
  console.log(`[轻装] 模式：${isMock() ? '演示(mock)，未读到可用的 API Key' : '真实调用百炼'}`)
})
