import { useState, useRef } from 'react'
import { generate } from './api.js'
import ResultView from './ResultView.jsx'
import imageCompression from 'browser-image-compression'

import { STYLES, styleFull } from './stylePresets.js'

/**
 * 房间照压缩：上传/拍照后先压到 1MB、长边 1440px 再送去 AI
 *
 * 为什么要压缩：
 *  - 手机原图 3–8MB，转 base64 后还要再膨胀约 33%，上传慢、代理层压力大
 *  - 视觉模型是「按 token 计费」的，图太大并不会更准，只是更贵更慢
 *  - 1440px 长边足够模型看清户型与软装，是精度与成本的平衡点
 *
 * 压缩跑在 Web Worker 里，不阻塞主线程，界面不会卡住。
 */
async function compressImage(file) {
  const from = file.size
  const toDataUrl = (blob) =>
    new Promise((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result)
      r.readAsDataURL(blob)
    })

  try {
    const out = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1440,
      useWebWorker: true,
      initialQuality: 0.85
    })
    return { dataUrl: await toDataUrl(out), from, to: out.size, ok: true }
  } catch {
    // 压缩失败就退回原图，不阻断流程
    return { dataUrl: await toDataUrl(file), from, to: from, ok: false }
  }
}

export default function App() {
  const [image, setImage] = useState(null)
  const [style, setStyle] = useState('奶油')
  const [clean, setClean] = useState(true) // 画面清理：默认开
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [err, setErr] = useState(null)
  const [preparing, setPreparing] = useState(false) // 压缩中
  const [comp, setComp] = useState(null) // 压缩结果 {from, to, ok}
  const [camOn, setCamOn] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  async function openCamera() {
    setErr(null)
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      streamRef.current = s
      setCamOn(true)
      // 等 DOM 就绪后挂流
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s
          videoRef.current.play()
        }
      })
    } catch (e) {
      setErr('摄像头打开失败（HTTPS 或未授权？），可直接上传图片')
    }
  }

  function stopCam() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCamOn(false)
  }

  async function capture() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9))
    if (!blob) return
    stopCam()
    setPreparing(true)
    const info = await compressImage(new File([blob], 'room.jpg', { type: 'image/jpeg' }))
    setImage(info.dataUrl)
    setComp(info)
    setPreparing(false)
  }

  async function onFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setPreparing(true)
    const info = await compressImage(f)
    setImage(info.dataUrl)
    setComp(info)
    setPreparing(false)
  }

  async function run() {
    if (!image) {
      setErr('请先拍照或上传房间照片')
      return
    }
    setLoading(true)
    setErr(null)
    try {
      const r = await generate({ image, style, clean })
      setResult({ ...r, style, clean, styleName: styleFull(style) })
    } catch (e) {
      setErr('生成失败：' + e.message)
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setResult(null)
    setImage(null)
    setErr(null)
  }

  if (result) return <ResultView result={result} onReset={reset} />

  return (
    <div className="app">
      <header className="hero">
        <h1>轻装</h1>
        <p className="sub">面向租房与宿舍青年的 AI 无痕空间改造助手</p>
        <p className="tagline">拍一张房间照，选一个风格，AI 帮你改造到能还原</p>
      </header>

      <section className="card">
        <h2>① 拍照 / 上传房间</h2>
        {image ? (
          <div className="uploaded">
            <img src={image} alt="房间原图" className="preview" />
            {comp?.ok && (
              <p className="comp-info">
                🗜️ 已压缩 {(comp.from / 1024 / 1024).toFixed(2)} MB →{' '}
                {(comp.to / 1024 / 1024).toFixed(2)} MB（省{' '}
                {Math.max(0, Math.round((1 - comp.to / comp.from) * 100))}%）
              </p>
            )}
            <div className="row">
              <button className="ghost" onClick={() => setImage(null)}>重拍 / 重选</button>
            </div>
          </div>
        ) : (
          <div className="upload">
            {preparing ? (
              <div className="ph">🗜️ 图片压缩中…</div>
            ) : camOn ? (
              <video ref={videoRef} className="preview" playsInline muted />
            ) : (
              <div className="ph">预览区</div>
            )}
            <div className="row">
              {camOn ? (
                <>
                  <button onClick={capture}>📸 拍下这张</button>
                  <button className="ghost" onClick={stopCam}>关闭</button>
                </>
              ) : (
                <button onClick={openCamera}>📷 打开摄像头</button>
              )}
              <label className="btn primary-file">
                📁 上传图片
                <input type="file" accept="image/*" onChange={onFile} hidden />
              </label>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>② 选择风格</h2>
        <div className="styles">
          {STYLES.map((s) => (
            <button
              key={s.id}
              className={'chip' + (style === s.id ? ' active' : '')}
              onClick={() => setStyle(s.id)}
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>

        <p className="style-desc">
          {STYLES.find((s) => s.id === style)?.desc}
        </p>

        <div className="clean-box">
          <div className="ct-left">
            <span className="ct-ico">🧹</span>
            <div className="ct-txt">
              <b>画面清理</b>
              <small>移除杂物、垃圾与脏乱物品，并修复常见画面瑕疵</small>
            </div>
          </div>
          <button
            className={'switch' + (clean ? ' on' : '')}
            onClick={() => setClean((v) => !v)}
            role="switch"
            aria-checked={clean}
            aria-label="画面清理开关"
          >
            <span className="knob" />
          </button>
        </div>
        <p className="ct-hint">
          {clean
            ? '开启：外卖盒、快递箱、散落电线、脏衣物等会被清掉，地面与台面恢复整洁。'
            : '关闭：仅更换软装，保留屋内原有物品，更贴近真实入住状态。'}
        </p>
      </section>

      {err && <p className="err">{err}</p>}

      <button className="primary big" onClick={run} disabled={loading || preparing || !image}>
        {loading ? 'AI 生成中…' : preparing ? '图片压缩中…' : '✨ 生成改造方案'}
      </button>
      <p className="hint">
        未配置百炼 API Key 时自动进入演示模式；配置后自动调用真实 AI 生图与识别。
      </p>
    </div>
  )
}
