/**
 * 生成等待提示：阶段文案 + 进度条 + 剩余秒数
 *
 * 为什么需要它：真实生图要 20–40 秒（qwen-image-2.1-pro 实测约 40s），
 * 这段时间页面如果没有任何变化，用户会以为卡死并反复点击或退出。
 *
 * 进度条刻意最多走到 95% —— 不到真正出结果绝不显示 100%，
 * 否则超时时会给用户"已经完成但其实还没好"的错觉。
 */
export default function WaitHint({ elapsed, estimate }) {
  const pct = Math.min(95, Math.round((elapsed / Math.max(estimate, 1)) * 100))
  const left = estimate - elapsed

  const stage =
    elapsed < 6 ? '① 识别空间类型与尺寸…' : '② AI 正在绘制改造效果图…'

  return (
    <div className="wait">
      <div className="wait-bar">
        <i style={{ width: pct + '%' }} />
      </div>
      <p className="wait-stage">{stage}</p>
      <p className="wait-sec">
        {left > 0 ? (
          <>
            预计还需 <b>{left}</b> 秒（全程约 {estimate} 秒）
          </>
        ) : (
          <>已等待 {elapsed} 秒，比预计慢一些，仍在生成中…</>
        )}
      </p>
      <p className="wait-tip">生成时间较长，请勿关闭页面或重复点击</p>
    </div>
  )
}
