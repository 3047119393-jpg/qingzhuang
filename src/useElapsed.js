import { useEffect, useState } from 'react'

/**
 * 生成耗时计时器（秒）
 * active 变 true 时从 0 开始计时，变 false 时清零。
 * 用于给几十秒的 AI 生图过程一个可见的进度反馈——没有任何提示时，
 * 用户会以为页面卡死而反复点击或直接退出。
 */
export function useElapsed(active) {
  const [sec, setSec] = useState(0)
  useEffect(() => {
    if (!active) {
      setSec(0)
      return
    }
    setSec(0)
    const t = setInterval(() => setSec((v) => v + 1), 1000)
    return () => clearInterval(t)
  }, [active])
  return sec
}
