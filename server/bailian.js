/**
 * 阿里云百炼（DashScope）调用层
 * 未设置 DASHSCOPE_API_KEY 时自动进入 mock，便于无 Key 也能跑通全流程。
 *
 * 三个能力：
 *   生图    Qwen-Image-Edit（图生图，保留原户型）  —— 不能用纯文生图，否则房间布局会变
 *   识别    Qwen3-VL（视觉理解，返回空间类型+尺寸）
 *   文案    Qwen-Plus（生成无痕可复原清单）
 *
 * 注意：百炼图像生成为异步任务，提交后需轮询 task 结果。
 */
// 惰性读取：ESM import 有提升，模块加载时 .env 还没载入，必须在使用时才读
const getKey = () => process.env.DASHSCOPE_API_KEY || ''
const isPlaceholder = (k) => /^sk-x{5,}/i.test(k)
const isMock = () => !getKey() || isPlaceholder(getKey())
export { isMock }

const BASE = 'https://dashscope.aliyuncs.com'

// 经实测（2026-10-19）：本账号下 qwen-image-edit-plus 不可用（Model not exist），
// 无 image-edit 系列，只能用通用生图模型做图生图。图像走「同步多模态」端点。
const MODEL_IMAGE = process.env.MODEL_IMAGE || 'qwen-image-2.0-pro'
const MODEL_VL = process.env.MODEL_VL || 'qwen3-vl-plus'
const MODEL_TEXT = process.env.MODEL_TEXT || 'qwen-plus'

/**
 * 各生图模型的实测出图耗时（2026-10-19，毛坯房图 + 完整提示词，单位秒）
 * 用于前端显示"预计还要多久"——生图要几十秒，没有进度提示用户会以为卡死。
 * 实测规律：模型越大越慢（2.0-pro 21s → 2.1-pro 40s → 3.0-pro 161s）。
 */
const IMAGE_ESTIMATE_SEC = {
  'qwen-image-2.0-pro': 21,
  'qwen-image-2.1-pro': 45, // 实测 40–49s（输入图越大越慢），取偏保守值
  'qwen-image-3.0-pro': 161
}
const estimateSec = (model) => IMAGE_ESTIMATE_SEC[model] || 30

/**
 * 出图质量档位：让用户自己权衡"等多久"与"画质多细"。
 * 前端只传档位 id（fast/fine），模型名不进前端——以后换模型改这里即可。
 */
const MODEL_OPTIONS = [
  {
    id: 'fast',
    label: '标准',
    emoji: '⚡',
    model: 'qwen-image-2.0-pro',
    desc: '约 21 秒出图，图约 1.5MB，手机加载快'
  },
  {
    id: 'fine',
    label: '精细',
    emoji: '🎨',
    model: 'qwen-image-2.1-pro',
    desc: '约 45 秒出图，软装细节更足，图约 6MB'
  }
].map((o) => ({ ...o, sec: estimateSec(o.model) }))

const DEFAULT_QUALITY = 'fast'
// 档位 id → 模型名；未知档位回退到环境变量指定的默认模型
const pickModel = (quality) =>
  MODEL_OPTIONS.find((o) => o.id === quality)?.model || MODEL_IMAGE
const qualityInfo = (quality) => MODEL_OPTIONS.find((o) => o.id === quality) || null

export { MODEL_IMAGE, estimateSec, MODEL_OPTIONS, DEFAULT_QUALITY, pickModel, qualityInfo }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const MOCK_LISTS = {
  奶油: [
    { name: '奶油色遮光窗帘', price: 89, restorable: true, note: '免打孔伸缩杆安装，退租整体拆走' },
    { name: '短绒米白地毯', price: 129, restorable: true, note: '直接铺设，卷起即还原地面' },
    { name: '暖光落地灯', price: 199, restorable: true, note: '插电即用，不改线路不钻孔' },
    { name: '藤编收纳篮（3只）', price: 69, restorable: true, note: '自由摆放，搬走直接带走' },
    { name: '可移除墙纸（局部）', price: 59, restorable: true, note: '背胶可撕除，不伤墙面' },
    { name: '棉麻抱枕（2个）', price: 79, restorable: true, note: '软装摆件，无任何固定' }
  ],
  工业: [
    { name: '黑色金属置物架', price: 189, restorable: true, note: '落地放置，无需膨胀螺丝' },
    { name: '爱迪生吊线灯', price: 129, restorable: true, note: '挂钩走明线，取下恢复原灯位' },
    { name: '水泥纹地砖贴', price: 99, restorable: true, note: '撕即掉，不伤原地板' },
    { name: '铁网收纳框', price: 59, restorable: true, note: '摆放式收纳' },
    { name: '深灰遮光窗帘', price: 95, restorable: true, note: '免打孔伸缩杆' }
  ],
  日式: [
    { name: '亚麻原色窗帘', price: 108, restorable: true, note: '免打孔杆安装' },
    { name: '榻榻米地垫', price: 165, restorable: true, note: '拼接铺设，卷走即还原' },
    { name: '纸质灯笼吊灯', price: 88, restorable: true, note: '插电式，无线路改动' },
    { name: '藤编收纳筐（2只）', price: 79, restorable: true, note: '摆放式' },
    { name: '棉麻床品三件套', price: 219, restorable: true, note: '直接更换' }
  ],
  中古: [
    { name: '胡桃色落地灯', price: 259, restorable: true, note: '插电即用' },
    { name: '复古花砖地贴', price: 118, restorable: true, note: '可撕除，不伤地板' },
    { name: '柚木边柜', price: 459, restorable: true, note: '独立家具，搬走即可' },
    { name: '黄铜装饰相框组', price: 89, restorable: true, note: '无痕挂钩悬挂' },
    { name: '丝绒墨绿窗帘', price: 139, restorable: true, note: '免打孔杆' },
    { name: '几何纹样地毯', price: 189, restorable: true, note: '卷起收纳即还原' }
  ],
  北欧: [
    { name: '浅木色置物架', price: 169, restorable: true, note: '落地放置，无需固定' },
    { name: '灰白几何地毯', price: 139, restorable: true, note: '直接铺设，卷走即还原' },
    { name: '棉麻灰蓝窗帘', price: 98, restorable: true, note: '免打孔伸缩杆' },
    { name: '白色纸质吊灯', price: 118, restorable: true, note: '插电式，不改线路' },
    { name: '彩色收纳盒（4只）', price: 59, restorable: true, note: '摆放式收纳' },
    { name: '龟背竹绿植摆件', price: 79, restorable: true, note: '可搬走' }
  ],
  原木: [
    { name: '实木落地衣架', price: 189, restorable: true, note: '落地放置，不靠墙固定' },
    { name: '原木色折叠桌', price: 259, restorable: true, note: '可折叠搬走' },
    { name: '藤编收纳筐（3只）', price: 89, restorable: true, note: '摆放式' },
    { name: '米白棉麻窗帘', price: 108, restorable: true, note: '免打孔杆安装' },
    { name: '木质香薰台灯', price: 149, restorable: true, note: '插电即用' },
    { name: '亚麻地垫', price: 129, restorable: true, note: '卷起即还原地面' }
  ],
  侘寂: [
    { name: '素色亚麻窗帘', price: 128, restorable: true, note: '免打孔杆' },
    { name: '水泥灰地贴', price: 99, restorable: true, note: '可撕除，不伤地板' },
    { name: '粗陶花器（2只）', price: 119, restorable: true, note: '摆放式' },
    { name: '原木矮凳', price: 159, restorable: true, note: '独立家具' },
    { name: '米灰棉麻地毯', price: 169, restorable: true, note: '卷起收纳即还原' },
    { name: '纸罩落地灯', price: 189, restorable: true, note: '插电即用' }
  ],
  新中式: [
    { name: '木质屏风隔断', price: 359, restorable: true, note: '落地折叠，搬走即还原' },
    { name: '水墨装饰挂画（3幅）', price: 129, restorable: true, note: '无痕挂钩悬挂' },
    { name: '胡桃木边几', price: 289, restorable: true, note: '独立家具' },
    { name: '棉麻素色窗帘', price: 118, restorable: true, note: '免打孔杆' },
    { name: '青瓷摆件组', price: 98, restorable: true, note: '摆放式' },
    { name: '竹编收纳篮', price: 79, restorable: true, note: '自由摆放' }
  ],
  法式: [
    { name: '珍珠白法式窗帘', price: 168, restorable: true, note: '免打孔伸缩杆' },
    { name: '水晶吊线灯', price: 219, restorable: true, note: '挂钩走明线' },
    { name: '雕花装饰镜', price: 189, restorable: true, note: '无痕挂钩悬挂' },
    { name: '丝绒抱枕（3个）', price: 119, restorable: true, note: '软装摆件' },
    { name: '石膏线装饰贴', price: 89, restorable: true, note: '背胶可撕除' },
    { name: '复古花纹地毯', price: 259, restorable: true, note: '卷起即还原' }
  ],
  极简: [
    { name: '纯白遮光窗帘', price: 88, restorable: true, note: '免打孔伸缩杆' },
    { name: '白色收纳箱（5只）', price: 99, restorable: true, note: '落地摆放，不固定' },
    { name: '简约白色台灯', price: 79, restorable: true, note: '插电即用' },
    { name: '浅灰纯色地垫', price: 89, restorable: true, note: '卷起即还原' },
    { name: '透明亚克力置物架', price: 129, restorable: true, note: '落地放置' },
    { name: '白色床品四件套', price: 199, restorable: true, note: '直接更换' }
  ],
  电竞: [
    { name: 'RGB 灯带（3米）', price: 79, restorable: true, note: '背胶粘贴，可撕除' },
    { name: '桌面理线槽套装', price: 39, restorable: true, note: '背胶固定，可移除' },
    { name: '电竞椅', price: 599, restorable: true, note: '独立家具，搬走即可' },
    { name: '显示器增高架', price: 89, restorable: true, note: '摆放式' },
    { name: '深色遮光窗帘', price: 108, restorable: true, note: '免打孔杆' },
    { name: '防滑电竞地垫', price: 149, restorable: true, note: '卷起即还原地面' }
  ],
  森系: [
    { name: '大型绿植（琴叶榕/天堂鸟）', price: 189, restorable: true, note: '可搬走' },
    { name: '悬挂式绿植挂篮（2只）', price: 99, restorable: true, note: '无痕挂钩悬挂' },
    { name: '藤编花架', price: 139, restorable: true, note: '落地放置' },
    { name: '苔藓装饰画', price: 88, restorable: true, note: '无痕挂钩' },
    { name: '棉麻绿格窗帘', price: 108, restorable: true, note: '免打孔杆' },
    { name: '草编收纳筐（3只）', price: 85, restorable: true, note: '摆放式' }
  ]
}

/* ---------- 通用：清理模型返回的 JSON（可能被 ```json 包裹） ---------- */
function parseJsonSafe(text, fallback) {
  try {
    return JSON.parse(String(text).replace(/```json|```/g, '').trim())
  } catch {
    return fallback
  }
}

/* ---------- 1) 改造效果图（图生图，保留原户型） ---------- */

/**
 * 风格别名：UI 上的短名 → 提示词里的完整风格表述
 * 直接用短名拼"风"字会别扭（如"森系风"、"极简风"），映射后模型理解更准。
 */
const STYLE_ALIAS = {
  奶油: '奶油风',
  工业: '工业风',
  日式: '日式',
  中古: '中古风',
  北欧: '北欧风',
  原木: '原木风',
  侘寂: '侘寂风',
  新中式: '新中式',
  法式: '法式复古',
  极简: '极简主义',
  电竞: '电竞风',
  森系: '森系自然风'
}

/**
 * 风格视觉锚点：告诉生图模型"这个风格长什么样"。
 *
 * 没有这段，模型只敢轻微调整（图生图模式尤其保守），改造前后几乎看不出区别。
 * 每条按 5 个维度写，覆盖了真实出租屋改造案例中影响力最大的要素：
 *   色调 → 材质/家具 → 灯光 → 织物软装 → 氛围
 * （"换灯光"被多个改造案例列为性价比最高的一步，早期版本漏了它，故本版补齐）
 */
const STYLE_VISUALS = {
  奶油: '奶油白与暖米色主调，圆弧形软包家具，暖黄色柔和氛围灯，奶油色窗帘与短绒地毯，纯色低饱和，温柔松弛',
  工业: '水泥灰与裸露质感墙面，黑色金属框架家具，复古爱迪生暖光灯泡，深色皮质沙发，铁件与做旧木，粗粝硬朗',
  日式: '原木色与米白，低矮家具与木格栅元素，暖色温纸罩灯，榻榻米或草编地垫，亚麻素色窗帘，安静祥和',
  中古: '胡桃木与柚木家具，黄铜灯具与摆件，琥珀色或橄榄绿点缀，复古几何纹样地毯，暖黄光晕，怀旧优雅',
  北欧: '白色与浅木色明亮基调，简约布艺沙发，几何造型灯具，绿植点缀，芥黄或墨绿抱枕提亮，通透清新',
  原木: '整屋原木色调，木质家具为主，藤编收纳筐，棉麻织物与地垫，暖白光源，自然温润',
  侘寂: '大地色与米灰低饱和，微水泥或矿物涂料质感墙面，枯枝与粗陶器皿，柔和漫射光，大量留白，静谧朴素',
  新中式: '深木色与米白，木质格栅与屏风元素，青瓷与红木摆件，暖黄宣纸灯，水墨意境，东方雅致',
  法式: '米白与奶油色墙面配线条装饰，水晶或黄铜吊灯，丝绒窗帘与织物，弧形家具轮廓，浪漫精致',
  极简: '纯白墙面与家具，隐藏式收纳，平整无装饰表面，柔和均匀光线，只保留必要物件，干净利落',
  电竞: '深色调房间，蓝紫粉渐变的 RGB 灯带发光，电竞桌椅，多显示器与机械键盘，遮光窗帘，科技感强烈',
  森系: '大量绿植与原木家具，藤编与棉麻，悬挂植物，暖白自然光，仿佛森林小屋，清新治愈'
}

/**
 * 真实改造手法（提炼自出租屋改造案例，注入提示词让改造更"像真的"）：
 * 换灯光 > 铺地毯 > 挂窗帘 > 遮墙面，是成本最低、视觉变化最大的四步。
 */
const RENOVATION_TECHNIQUES =
  '改造手法参考：把刺眼冷白光换成暖色氛围照明，' +
  '用窗帘、地毯、抱枕等织物统一色调并遮盖老旧地面，' +
  '墙面用可移除挂布或贴纸遮盖污渍与瑕疵。'

/**
 * 构造生图提示词
 * @param {string} style 风格：奶油/工业/日式/中古/北欧/原木/侘寂/新中式/法式/极简/电竞/森系
 * @param {boolean} clean 是否开启「画面清理」：移除杂物垃圾 + 抑制生成瑕疵
 *
 * 提示词设计要点：
 *  - 约束顺序有讲究：先给风格视觉锚点（让 AI 知道改成什么样），
 *    再锁户型（判分看这个），最后画质与去瑕疵。
 *  - 「保持结构」和「风格鲜明」是一对矛盾约束：只强调前者会让 AI 过度保守、
 *    改造前后几乎没区别（实测教训），所以要显式要求"风格元素必须明显可辨"。
 *  - 「清理杂物」用枚举式列举具体物品，比抽象的"整理干净"有效得多。
 *  - 结尾加负面约束（不要出现畸变/多余物体），可显著降低 AI 生成的伪影。
 */
export function buildPrompt(style, clean) {
  const styleName = STYLE_ALIAS[style] || style + '风'
  const visual = STYLE_VISUALS[style] || ''
  const lines = [
    `把这张房间照片改成${styleName}的软装改造效果图。`,
    visual ? `风格视觉要点（改造后必须清晰体现这些元素，让风格一眼可辨）：${visual}。` : '',
    RENOVATION_TECHNIQUES,
    `硬性要求：保持原房间的户型结构、门窗位置、墙体走向、层高与相机视角不变，不得改动格局；`,
    `在此基础上大胆更换窗帘、地毯、灯具、家具软装、墙面装饰与整体配色，充分体现${styleName}的特征。`,
    `保留原有大件家具的位置与体量，只做软装层面的更换与美化。`
  ].filter(Boolean)

  if (clean) {
    lines.push(
      // 2. 清理杂物：枚举具体垃圾类型，模型对具体名词的响应远好于抽象描述
      `清理画面中的所有杂物与垃圾：外卖盒、快递纸箱、塑料袋、散落的数据线与插排、`,
      `堆叠的脏衣物、空瓶罐、地面与桌面的散落物、墙角堆放的杂物，让地面、桌面、床面整洁干净。`,
      `除改造所需的软装外，不要新增任何与改造无关的物品。`
    )
  }

  lines.push(
    // 3. 无痕约束：对应清单的「可复原」规则，图上必须一致
    `只使用可移除、免打孔的无痕方案：窗帘用免打孔伸缩杆，地面用可卷起的地毯地垫，`,
    `灯具用插电式或挂钩走明线，收纳用落地式与摆放式，墙面用可撕除背胶与无痕挂钩。`,
    // 4. 负面约束：抑制常见的 AI 生成伪影
    `画风为真实室内摄影，透视正确、光影自然、材质细节清晰。`,
    `画面中不要出现畸变、扭曲、重影、悬浮杂物、多余或残缺的物体。`
  )

  return lines.join('')
}

export async function generateImage(image, style, opts = {}) {
  if (isMock()) return { url: image, mock: true }
  const KEY = getKey()
  const clean = opts.clean !== false // 默认开启清理
  // 质量档位决定用哪个生图模型（fast=2.0-pro / fine=2.1-pro）
  const model = pickModel(opts.quality)

  const prompt = buildPrompt(style, clean)

  // 同步多模态端点（recommended）：content 里传 image + text
  const r = await fetch(`${BASE}/api/v1/services/aigc/multimodal-generation/generation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      input: { messages: [{ role: 'user', content: [{ image }, { text: prompt }] }] },
      // n 必须显式写 1：生图按张计费，默认可能生成多张，会成倍烧额度
      parameters: { prompt_extend: true, watermark: false, n: 1 }
    })
  })
  const j = await r.json()
  const url = j?.output?.choices?.[0]?.message?.content?.[0]?.image
  if (!url) throw new Error('生图失败: ' + JSON.stringify(j).slice(0, 300))
  return { url, mock: false }
}

/* ---------- 2) 空间识别（类型 + 估算尺寸） ---------- */
export async function recognizeRoom(image) {
  if (isMock()) return { type: '卧室', length_m: 4.2, width_m: 3.1 }
  const KEY = getKey()

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
                '识别这张房间照片：空间类型(卧室/客厅/宿舍/厨房/书房/其他)，并估算房间长、宽（米）。' +
                '只返回 JSON，形如 {"type":"卧室","length_m":4.2,"width_m":3.1}，不要任何解释文字。'
            }
          ]
        }
      ]
    })
  })
  const j = await r.json()
  const text = j?.choices?.[0]?.message?.content
  const o = parseJsonSafe(text, {})
  // 模型实际返回的字段名不稳定（space_type / width_meters 等），统一归一化
  return {
    type: o.type ?? o.space_type ?? o.room_type ?? o.category ?? '未知',
    length_m: Number(o.length_m ?? o.length_meters ?? o.length ?? 0) || 0,
    width_m: Number(o.width_m ?? o.width_meters ?? o.width ?? 0) || 0
  }
}

/* ---------- 3) 无痕改造清单（核心创新：可复原规则） ---------- */
export async function generateRenovation(room, style) {
  if (isMock()) return MOCK_LISTS[style] || MOCK_LISTS['奶油']
  const KEY = getKey()

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
  const text = j?.choices?.[0]?.message?.content
  const list = parseJsonSafe(text, null)
  return Array.isArray(list) && list.length ? list : MOCK_LISTS[style] || MOCK_LISTS['奶油']
}
