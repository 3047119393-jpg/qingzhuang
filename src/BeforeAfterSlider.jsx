import { useRef, useState, useCallback } from 'react'

/**
 * before / after 拖拽对比滑块
 *
 * 设计要点（为什么这样写）：
 *  1. 两张图用同一容器 + object-fit: cover 铺满 —— 同一画框、同一视角，
 *     户型/布局有没有被改动能一眼看出来（这是本项目验收核心）。
 *  2. 用 Pointer Events 统一鼠标与触摸，手机端可拖。
 *  3. 容器 touch-action: pan-y —— 横向拖拽被接管，纵向仍可正常滚页面。
 *  4. 上层图为原图，按 pos 百分比裁切显示，露出下层改造图。
 */
export default function BeforeAfterSlider({
  before,
  after,
  beforeLabel = '原房间',
  afterLabel = '改造后'
}) {
  const [pos, setPos] = useState(50)
  const boxRef = useRef(null)
  const dragging = useRef(false)

  const update = useCallback((clientX) => {
    const el = boxRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (!r.width) return
    const p = ((clientX - r.left) / r.width) * 100
    setPos(Math.max(0, Math.min(100, p)))
  }, [])

  function onDown(e) {
    dragging.current = true
    if (e.currentTarget.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    }
    update(e.clientX)
  }
  function onMove(e) {
    if (!dragging.current) return
    update(e.clientX)
  }
  function onUp() {
    dragging.current = false
  }

  return (
    <div
      className="ba"
      ref={boxRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <img className="ba-img" src={after} alt={afterLabel} draggable="false" />

      <div className="ba-clip" style={{ width: pos + '%' }}>
        <img className="ba-img" src={before} alt={beforeLabel} draggable="false" />
      </div>

      <div className="ba-handle" style={{ left: pos + '%' }}>
        <span className="ba-arrow">‹ ›</span>
      </div>

      <span className="ba-tag left">{beforeLabel}</span>
      <span className="ba-tag right">{afterLabel}</span>
    </div>
  )
}
