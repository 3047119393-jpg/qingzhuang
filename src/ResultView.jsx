import { useState } from 'react'
import SharePoster from './SharePoster.jsx'
import BeforeAfterSlider from './BeforeAfterSlider.jsx'
import { generate } from './api.js'
import { styleFull } from './stylePresets.js'

export default function ResultView({ result, onReset }) {
  // 用内部 state 承接结果：这样「重新生成」可以原地替换，不必退回首页重走流程
  const [data, setData] = useState(result)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const { before, after, mock, room, list, style, clean } = data
  const total = (list || []).reduce((s, it) => s + (Number(it.price) || 0), 0)
  const styleName = data.styleName || styleFull(style)

  /**
   * 重出一版效果图。
   * clean=true  → 让 AI 顺手清掉杂物垃圾、修复画面瑕疵
   * clean=false → 只换软装，保留屋内原样
   * 注意：这里用 before（原图）而不是 after（已改图）作为输入，
   *       否则会"改上加改"，户型漂移风险成倍增加。
   */
  async function regenerate(nextClean) {
    setBusy(true)
    setErr(null)
    try {
      const r = await generate({ image: before, style, clean: nextClean })
      if (r?.ok === false) throw new Error(r.error || '生成失败')
      setData({ ...r, style, clean: nextClean, styleName: styleFull(style) })
    } catch (e) {
      setErr('重新生成失败：' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="hero">
        <h1>改造方案</h1>
        <p className="sub">
          {mock ? '演示模式（未接百炼，改造后为风格滤镜示意）' : '真实 AI 生成'} · {styleName}
          {' · '}
          {clean === false ? '保留原样' : '已清理杂物'}
        </p>
      </header>

      <section className="card">
        <h2>Before / After</h2>
        <BeforeAfterSlider before={before} after={after} />
        {mock && (
          <p className="hint">
            演示模式：改造后用风格滤镜示意，接入百炼 Key 后自动替换为真实生成图（保留原户型）。
          </p>
        )}

        <div className="regen">
          <button className="ghost" disabled={busy} onClick={() => regenerate(true)}>
            🧹 {busy ? '重生成中…' : '清理杂物再出一版'}
          </button>
          {clean !== false && (
            <button className="ghost" disabled={busy} onClick={() => regenerate(false)}>
              ↺ 保留原样重出
            </button>
          )}
        </div>
        {err && <p className="err">{err}</p>}
      </section>

      {room && (
        <section className="card">
          <h2>空间识别</h2>
          <p className="room">
            类型：<b>{room.type}</b>　尺寸：约 <b>{room.length_m} × {room.width_m}</b> m
          </p>
        </section>
      )}

      <section className="card">
        <h2>③ 无痕改造清单</h2>
        <ul className="list">
          {(list || []).map((it, i) => (
            <li key={i}>
              <div className="li-head">
                <span className="name">{it.name}</span>
                <span className="price">¥{it.price}</span>
            </div>
              <div className="li-meta">
                <span className={'tag ' + (it.restorable ? 'ok' : 'warn')}>
                  {it.restorable ? '✓ 无痕可复原' : '△ 需注意'}
                </span>
                <span className="note">{it.note}</span>
              </div>
            </li>
          ))}
        </ul>
        <p className="budget">预算合计 <b>¥{total}</b></p>
      </section>

      <SharePoster result={data} />

      <button className="primary big" onClick={onReset}>↻ 再做一个</button>
      <p className="hint">每一件都标注了「免打孔 / 可移除 / 零墙面损伤」，退租可完整复原。</p>
    </div>
  )
}
