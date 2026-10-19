/**
 * 生产环境代理：EdgeOne Pages Functions
 * 路由：POST /api/generate
 *
 * 安全：DASHSCOPE_API_KEY 只在平台「环境变量」里配置，
 *      浏览器拿到的是本函数的响应，永远接触不到密钥。
 *
 * 流程：识别空间(视觉) → 并行[生图(图生图,保户型) + 出清单(文本)]
 */
const BASE = 'https://dashscope.aliyuncs.com'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS }
  })

const parseJsonSafe = (text, fallback) => {
  try {
    return JSON.parse(String(text).replace(/```json|```/g, '').trim())
  } catch {
    return fallback
  }
}

async function sha256(s) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return String(s.length) + '|' + String(s).slice(-32)
  }
}

// 轻量内存缓存（边缘函数无磁盘，实例级最佳努力；重启失效但省钱）
const mem = new Map()
const MEM_MAX = 100

async function recognizeRoom(KEY, MODEL_VL, image) {
  const r = await fetch(`${BASE}/compatible-mode/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_VL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: image } },
            {
              type: 'text',
              text:
                '识别这张房间照片的空间类型（卧室/客厅/宿舍/厨房/书房/其他），并估算房间的长、宽（米）。' +
                '只返回 JSON，形如 {"type":"卧室","length_m":4.2,"width_m":3.1}，不要任何解释文字。'
            }
          ]
        }
      ]
    })
  })
  const j = await r.json()
  const o = parseJsonSafe(j?.choices?.[0]?.message?.content, {})
  return {
    type: o.type ?? o.space_type ?? o.room_type ?? o.category ?? '未知',
    length_m: Number(o.length_m ?? o.length_meters ?? o.length ?? 0) || 0,
    width_m: Number(o.width_m ?? o.width_meters ?? o.width ?? 0) || 0
  }
}

async function generateRenovation(KEY, MODEL_TEXT, room, style) {
  const area = (Number(room.length_m) || 4) * (Number(room.width_m) || 3)
  const r = await fetch(`${BASE}/compatible-mode/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_TEXT,
      messages: [
        {
          role: 'user',
          content:
            `为${room.type || '房间'}（约${area.toFixed(1)}平方米）生成一份「${STYLE_ALIAS[style] || style + '风'}」无痕可复原软装改造清单，6-9项。\n` +
            `硬约束：不得涉及打孔、刷墙、改水电、固定家具等不可复原操作。\n` +
            `每项字段：name(物品名)、price(人民币整数单价)、restorable(布尔，是否可复原)、note(可复原说明，如"免打孔伸缩杆安装")。\n` +
            `只返回 JSON 数组，不要任何解释文字。`
        }
      ]
    })
  })
  const j = await r.json()
  const list = parseJsonSafe(j?.choices?.[0]?.message?.content, null)
  return Array.isArray(list) && list.length ? list : []
}

// 与 server/bailian.js 的 buildPrompt 保持一致（云函数独立部署，不共享 server 目录）
const STYLE_ALIAS = {
  奶油: '奶油风', 工业: '工业风', 日式: '日式', 中古: '中古风',
  北欧: '北欧风', 原木: '原木风', 侘寂: '侘寂风', 新中式: '新中式',
  法式: '法式复古', 极简: '极简主义', 电竞: '电竞风', 森系: '森系自然风'
}

function buildPrompt(style, clean) {
  const styleName = STYLE_ALIAS[style] || style + '风'
  const lines = [
    `把这张房间照片改成${styleName}的软装改造效果图。`,
    `硬性要求：严格保持原房间的户型结构、门窗位置、墙体走向、层高与相机视角不变，不得改动格局。`,
    `保留原有大件家具的位置与体量，只做软装层面的更换与美化。`
  ]
  if (clean) {
    lines.push(
      `清理画面中的所有杂物与垃圾：外卖盒、快递纸箱、塑料袋、散落的数据线与插排、`,
      `堆叠的脏衣物、空瓶罐、地面与桌面的散落物、墙角堆放的杂物，让地面、桌面、床面整洁干净。`,
      `除改造所需的软装外，不要新增任何与改造无关的物品。`
    )
  }
  lines.push(
    `只使用可移除、免打孔的无痕方案：窗帘用免打孔伸缩杆，地面用可卷起的地毯地垫，`,
    `灯具用插电式或挂钩走明线，收纳用落地式与摆放式，墙面用可撕除背胶与无痕挂钩。`,
    `画风为真实室内摄影，透视正确、光影自然、材质细节清晰。`,
    `画面中不要出现畸变、扭曲、重影、悬浮杂物、多余或残缺的物体。`
  )
  return lines.join('')
}

async function generateImage(KEY, MODEL_IMAGE, image, style, clean) {
  const prompt = buildPrompt(style, clean !== false)

  const r = await fetch(`${BASE}/api/v1/services/aigc/multimodal-generation/generation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_IMAGE,
      input: { messages: [{ role: 'user', content: [{ image }, { text: prompt }] }] },
      parameters: { prompt_extend: true, watermark: false, n: 1 }
    })
  })
  const j = await r.json()
  const url = j?.output?.choices?.[0]?.message?.content?.[0]?.image
  if (!url) throw new Error('生图失败: ' + JSON.stringify(j).slice(0, 300))
  return url
}

export async function onRequestPost(context) {
  const { request, env } = context
  const KEY = env?.DASHSCOPE_API_KEY
  if (!KEY) return json({ ok: false, error: '平台未配置 DASHSCOPE_API_KEY' }, 500)

  try {
    const body = await request.json().catch(() => ({}))
    const { image, style } = body || {}
    if (!image) return json({ ok: false, error: '缺少图片' }, 400)
    if (!style) return json({ ok: false, error: '缺少风格' }, 400)

    const MODEL_IMAGE = env.MODEL_IMAGE || 'qwen-image-2.0-pro'
    const MODEL_VL = env.MODEL_VL || 'qwen3-vl-plus'
    const MODEL_TEXT = env.MODEL_TEXT || 'qwen-plus'

    const clean = body.clean !== false
    const cacheKey = (await sha256(image + '|' + style + '|' + (clean ? 'clean' : 'raw'))).slice(0, 16)
    if (mem.has(cacheKey)) {
      return json({ ...mem.get(cacheKey), before: image, cached: true })
    }

    const room = await recognizeRoom(KEY, MODEL_VL, image)
    const [after, list] = await Promise.all([
      generateImage(KEY, MODEL_IMAGE, image, style, clean),
      generateRenovation(KEY, MODEL_TEXT, room, style)
    ])

    const payload = { ok: true, mock: false, after, room, list, clean }
    mem.set(cacheKey, payload)
    if (mem.size > MEM_MAX) mem.delete(mem.keys().next().value)

    return json({ ...payload, before: image })
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 500)
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: { ...CORS, 'Access-Control-Max-Age': '86400' }
  })
}
