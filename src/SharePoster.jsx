import { useState } from 'react'
import { buildPoster } from './poster.js'
import { exportVideo } from './video.js'

export default function SharePoster({ result }) {
  const [poster, setPoster] = useState(null)
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState('')

  async function make() {
    setBusy('poster')
    setMsg('')
    try {
      setPoster(await buildPoster(result))
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(null)
    }
  }

  async function video() {
    setBusy('video')
    setMsg('')
    try {
      const blob = await exportVideo(result, { duration: 5000 })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = '轻装-改造前后对比.webm'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      setMsg('短视频已导出')
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(null)
    }
  }

  function save() {
    if (!poster) return
    const a = document.createElement('a')
    a.href = poster
    a.download = '轻装-改造方案.jpg'
    a.click()
  }

  return (
    <section className="card">
      <h2>④ 分享海报 / 短视频</h2>

      <div className="row">
        <button onClick={make} disabled={!!busy}>
          {busy === 'poster' ? '海报生成中…' : '🖼 生成分享海报'}
        </button>
      </div>

      <div className="row">
        <button onClick={video} disabled={!!busy}>
          {busy === 'video' ? '录制中…(约5秒)' : '🎬 导出短视频'}
        </button>
        {poster && (
          <button className="ghost" onClick={save}>
            ⬇ 保存海报
          </button>
        )}
      </div>

      {msg && <p className={msg.includes('失败') ? 'err' : 'hint'}>{msg}</p>}

      {poster && (
        <div className="poster-preview">
          <img src={poster} alt="《轻装》改造分享海报" />
          <p className="hint">手机长按图片 → 保存到相册</p>
        </div>
      )}
    </section>
  )
}
