// 前端只调自己的 /api 代理，绝不持有也不暴露百炼 API Key

const MOCK_LISTS = {
  奶油: [
    { name: '奶油色遮光窗帘', price: 89, restorable: true, note: '免打孔伸缩杆安装，退租整体拆走' },
    { name: '短绒米白地毯', price: 129, restorable: true, note: '直接铺设，卷起即还原地面' },
    { name: '暖光落地灯', price: 199, restorable: true, note: '插电即用，不改线路不钻孔' },
    { name: '藤编收纳篮（3只）', price: 69, restorable: true, note: '自由摆放，搬走直接带走' },
    { name: '可移除墙纸（局部）', price: 59, restorable: true, note: '背胶可撕除，不伤墙面' },
    { name: '棉麻抱枕（2个）', price: 79, restorable: true, note: '软装摆件，无任何固定' },
    { name: '原木免钉书架', price: 249, restorable: true, note: '落地置物架，不靠墙固定' }
  ],
  工业: [
    { name: '黑色金属置物架', price: 189, restorable: true, note: '落地放置，无需膨胀螺丝' },
    { name: '爱迪生吊线灯', price: 129, restorable: true, note: '挂钩走明线，取下恢复原灯位' },
    { name: '水泥纹地砖贴', price: 99, restorable: true, note: '撕即掉，不伤原地板' },
    { name: '铁网收纳框', price: 59, restorable: true, note: '摆放式收纳' },
    { name: '深灰遮光窗帘', price: 95, restorable: true, note: '免打孔伸缩杆' },
    { name: '皮质懒人沙发', price: 399, restorable: true, note: '可搬走家具' }
  ],
  日式: [
    { name: '亚麻原色窗帘', price: 108, restorable: true, note: '免打孔杆安装' },
    { name: '榻榻米地垫', price: 165, restorable: true, note: '拼接铺设，卷走即还原' },
    { name: '纸质灯笼吊灯', price: 88, restorable: true, note: '插电式，无线路改动' },
    { name: '藤编收纳筐（2只）', price: 79, restorable: true, note: '摆放式' },
    { name: '落地实木书桌', price: 299, restorable: true, note: '独立家具，不固定' },
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
    { name: '绿植摆件（龟背竹）', price: 79, restorable: true, note: '可搬走' },
    { name: '原木餐边小桌', price: 219, restorable: true, note: '独立家具' }
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
    { name: '草编收纳筐（3只）', price: 85, restorable: true, note: '摆放式' },
    { name: '木质花器套装', price: 69, restorable: true, note: '自由摆放' }
  ]
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export async function generate({ image, style, clean = true }) {
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, style, clean })
    })
    if (!res.ok) throw new Error('代理服务未就绪')
    return await res.json()
  } catch {
    // 无后端 / 无 Key 时的本地演示兜底，保证前端独立可跑
    await wait(900)
    return {
      ok: true,
      mock: true,
      before: image,
      after: image, // 演示模式：前端用风格滤镜示意改造后效果
      room: { type: '卧室', length_m: 4.2, width_m: 3.1 },
      list: MOCK_LISTS[style] || MOCK_LISTS['奶油'],
      clean
    }
  }
}
