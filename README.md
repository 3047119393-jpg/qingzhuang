# 《轻装》Web 应用

面向租房与宿舍青年的 AI 无痕空间改造助手。
拍一张房间照 → 选风格 → AI 生成改造效果图（before/after）+ 输出**无痕可复原**改造清单。

## 架构（关键：Key 不进前端）

```
前端 React(Vite)  ──→  /api 代理层(Node)  ──→  阿里云百炼
                         ↑ 持有 DASHSCOPE_API_KEY
```

浏览器永远拿不到 API Key。部署时把代理层放到云函数即可（EdgeOne Pages Functions / 阿里云 FC）。

## 部署（免费额度足够，见下）

- 静态资源：EdgeOne Pages 托管 `dist/`
- 动态接口：`functions/api/*`（Pages Functions），密钥存平台环境变量
- HTTPS：平台免费证书，**摄像头功能依赖 HTTPS，必须保留**

### 部署步骤
1. 打包：`npm run build` → 生成 `dist/`
2. 上传：在 EdgeOne Pages 控制台新建项目，上传 `dist/` 与 `functions/`（或连 Git 仓库自动构建）
3. 配置环境变量（控制台 → 环境变量）：
   ```
   DASHSCOPE_API_KEY=sk-你的key
   MODEL_IMAGE=qwen-image-2.0-pro
   MODEL_VL=qwen3-vl-plus
   MODEL_TEXT=qwen-plus
   ```
4. 拿到 HTTPS 在线链接，访问 `/api/health`，确认返回 `{"mock":false}`
5. **保持在线至 11/15**（专项选拔赛评审 11/7–15）
6. 在系统报名表填写**在线地址 + 评审期测试账号**

### 部署费用
| 项 | 费用 |
|---|---|
| EdgeOne Pages 免费版静态托管 | **¥0**（流量/请求数不限） |
| Pages Functions | **¥0**（免费额度内） |
| HTTPS 证书 | **¥0**（平台免费签发） |
| 平台免费二级域名 | **¥0** |
| 自定义域名 | 约 ¥30–80/年（且国内需备案，可选） |

> 独立于此的开销只有 **AI 生图**（百炼免费 100 张，之后 ¥0.5/张）。

## 目录

```
qingzhuang/
├── index.html            # 入口（含 PWA meta）
├── public/               # PWA 图标（192/512/maskable/apple-touch-icon）
├── src/
│   ├── main.jsx          # 挂载 + 注册 Service Worker
│   ├── App.jsx           # 拍照/上传（含压缩）+ 选风格 + 提交
│   ├── ResultView.jsx    # before/after 滑块 + 无痕改造清单 + 重新生成
│   ├── BeforeAfterSlider.jsx  # 原生拖拽对比滑块
│   ├── SharePoster.jsx   # 功能④：分享海报 / 短视频 UI
│   ├── stylePresets.js   # 12 种风格库
│   ├── poster.js         # 功能④：Canvas 海报绘制
│   ├── video.js          # 功能④：MediaRecorder 短视频导出
│   ├── api.js            # 前端只调 /api；无后端时本地演示兜底
│   └── styles.css        # 移动端优先
├── functions/            # 生产环境接口（Pages Functions）
│   └── api/
│       ├── generate.js
│       └── health.js
├── server/               # 本地开发代理（Express）
│   ├── index.js
│   ├── bailian.js
│   └── .env.example
└── edgeone.json          # 部署配置
```

## 技术栈与开源依赖

| 依赖 | 许可证 | 用途 |
|---|---|---|
| React 18 | MIT | UI 框架 |
| Vite 5 | MIT | 构建 / 开发服务器 / API 代理 |
| browser-image-compression | MIT | 上传前本地压缩（多线程，不阻塞界面） |
| vite-plugin-pwa（Workbox） | MIT | PWA：添加到主屏幕 + 离线可用 |

> 比赛合规提示：上述均为通用工具库，创新点（无痕可复原规则库、流程编排、密钥隔离架构）为学生自主设计，
> 已在《OPC创新实践说明》第五章「第三方资源及合规说明」中如实披露。

## 本地跑起来

**方式 A：只跑前端（不需要后端，自动演示模式）**
```bash
npm install
npm run dev
# 打开 http://localhost:5173
```

**方式 B：前端 + 代理层（配了 Key 就是真实 AI）**
```bash
# 终端 1：代理层
cd server
npm install
cp .env.example .env      # 填入 DASHSCOPE_API_KEY
cd ..
npm run server            # http://localhost:8787

# 终端 2：前端（vite 已配好 /api 代理到 8787）
npm run dev
```

## 三个 AI 能力（百炼）

| 能力 | 模型（可用环境变量覆盖） | 说明 |
|---|---|---|
| 改造效果图 | `MODEL_IMAGE` = `qwen-image-2.0-pro` | **必须图生图**，纯文生图会改变户型（`qwen-image-edit` 系列本账号不可用） |
| 空间识别 | `MODEL_VL` = `qwen3-vl-plus` | 返回空间类型 + 估算长宽（米） |
| 改造清单 | `MODEL_TEXT` = `qwen-plus` | 按「免打孔/可移除/零墙面损伤」硬约束生成 |

模型 ID 以百炼控制台「模型广场」实时可用为准，不一致时改 `.env` 即可，不用动代码。

## 已完成（MVP 四个核心功能）

- [x] ① 拍照 / 上传房间（含摄像头采集）
- [x] ② 风格生成 + before/after 拖拽对比滑块
  - **12 种风格**：奶油 / 工业 / 日式 / 中古 / 北欧 / 原木 / 侘寂 / 新中式 / 法式复古 / 极简白 / 电竞 / 森系
  - 每个风格带一句话说明；风格名经别名映射保证提示词精准（如"森系"→"森系自然风"）
- [x] ③ 无痕改造清单（物品 + 价格 + 预算 + 可复原说明）
- [x] ④ 分享海报（Canvas 绘制导出）+ 短视频导出（MediaRecorder）
- [x] 🧹 画面清理（生成时移除外卖盒/纸箱/脏衣/散落电线等杂物 + 抑制 AI 生成瑕疵）
  - 前端开关可切换，默认开启；开关参与缓存 key，两种模式各自缓存
  - 结果页提供「清理杂物再出一版 / 保留原样重出」按钮，输入始终用原图（避免改上加改导致户型漂移）

## 尚未实现（排期）

- [x] ~~PWA（添加到主屏幕）~~ → 已通过 `vite-plugin-pwa` 实现
- [ ] 部署上线 + SSL（摄像头需 HTTPS，评审期须保持在线至 11/15）⏰ 关键路径
- [ ] 10 人试用反馈收集
- [ ] 作品截图（用于申报材料与评审）
- [ ] 评审视频录制（11/3–11/6，须真实运行录屏，不得用概念动画替代）
- [ ] 答辩 PPT（备国赛）

> ⚠️ 摄像头 `getUserMedia` 在非 localhost 环境要求 HTTPS，部署务必配 SSL，否则拍照功能直接废。
