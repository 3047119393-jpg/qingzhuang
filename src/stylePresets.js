/**
 * 风格库：面向租房/宿舍青年的主流审美
 *
 * 字段说明：
 *   id    —— 传给后端的风格标识（参与缓存 key）
 *   label —— UI 上的短标签（3 字以内，适配 3 列网格）
 *   emoji —— 视觉锚点，帮助快速识别
 *   full  —— 完整风格名，用于结果页与海报展示（"法式"→"法式复古"）
 *   desc  —— 一句话说明，帮助用户区分风格差异
 */
export const STYLES = [
  { id: '奶油', label: '奶油风', emoji: '🧈', full: '奶油风', desc: '暖白低饱和，温柔松弛，最不挑采光' },
  { id: '工业', label: '工业风', emoji: '🏭', full: '工业风', desc: '水泥金属黑灰，硬朗酷感，男生首选' },
  { id: '日式', label: '日式', emoji: '🍵', full: '日式', desc: '原木藤编低姿，素净克制，小空间显大' },
  { id: '中古', label: '中古风', emoji: '📻', full: '中古风', desc: '胡桃木配黄铜，复古质感，层次丰富' },
  { id: '北欧', label: '北欧', emoji: '🪵', full: '北欧风', desc: '浅木灰白撞色，明亮通透，性价比高' },
  { id: '原木', label: '原木风', emoji: '🌳', full: '原木风', desc: '整屋木质基调，自然温润，耐看不腻' },
  { id: '侘寂', label: '侘寂风', emoji: '🍂', full: '侘寂风', desc: '素水泥与亚麻，大量留白，安静治愈' },
  { id: '新中式', label: '新中式', emoji: '🏮', full: '新中式', desc: '木格栅配水墨，东方雅致，适合大开间' },
  { id: '法式', label: '法式复古', emoji: '🕯️', full: '法式复古', desc: '石膏线与水晶灯，浪漫精致，奶油色打底' },
  { id: '极简', label: '极简白', emoji: '⬜', full: '极简主义', desc: '纯白无杂物，收纳先行，成本最低' },
  { id: '电竞', label: '电竞风', emoji: '🎮', full: '电竞风', desc: 'RGB 灯带与理线，桌面氛围拉满' },
  { id: '森系', label: '森系', emoji: '🌿', full: '森系自然风', desc: '绿植藤蔓为主，清新治愈，好养活优先' }
]

/** 取风格的完整名称（用于结果页与海报展示） */
export const styleFull = (id) => STYLES.find((s) => s.id === id)?.full || id + '风'
