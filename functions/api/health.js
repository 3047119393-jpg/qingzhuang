/**
 * 健康检查：GET /api/health
 * 用于确认部署后密钥是否生效（mock=false 表示真实调用百炼）
 */
export async function onRequestGet(context) {
  const KEY = context?.env?.DASHSCOPE_API_KEY
  return new Response(
    JSON.stringify({ ok: true, mock: !KEY, ts: Date.now() }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    }
  )
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  })
}
