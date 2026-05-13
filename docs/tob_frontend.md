嵌入模式需求文档

> 文档版本：v1.0
> 创建日期：2026-04-27
> 受众：前端工程师
> 关联文档：[PRD-overview.md](PRD-overview.md)、[PRD-tob-module.md](PRD-tob-module.md)


---

1. 范围

在现有 [h2-market](../../h2-market/) 项目中**新增"嵌入模式"路由 `/embed/*`**，作为被渠道方 iframe 嵌入的 B 端版本。

核心区别（嵌入模式 vs 主站模式）：

维度
主站模式（C2C / 现有）
嵌入模式（B 端 / 新增）
用户身份
Privy 社交登录 / 邮箱
渠道方 SSO Token
钱包接入
Privy embedded wallet + Alchemy AA
无钱包接入，所有交易由后端代签
余额来源
用户自管钱包
渠道账本 + tob 后端聚合
下单方式
前端直签 + 直连 dYdX
调 tob 后端 API
跨链
前端 SDK 直接调
tob/signer 后端代理
支付 gas
Paymaster 代付
tob/signer 内部 gas-tank

目标：最大限度复用主站现有 UI 和业务逻辑，仅替换"鉴权层 + 交易提交层"。


---

2. 技术栈

沿用 h2-market 现有栈（[h2-market/CLAUDE.md](../../h2-market/CLAUDE.md)）：
- Next.js 14 App Router、React 18、TypeScript
- Tailwind CSS + Ant Design 5
- Zustand stores、TanStack Query、SWR
- Cloudflare Pages + @opennextjs/cloudflare
- i18n（15+ 语言）
新增依赖：无（嵌入模式去掉 Privy / Alchemy 即可，不引入新库）


---

3. 路由设计

app/
├── (main)/                  # 现有主站路由（不动）
└── embed/                   # ★ 新增嵌入模式
    ├── layout.tsx           # 嵌入版 layout（极简，无主站 header / footer）
    ├── page.tsx             # 嵌入页入口（市场列表）
    ├── market/[id]/page.tsx # 单市场详情 + 下单
    ├── allbet/[id]/page.tsx # 亚盘市场详情
    ├── portfolio/page.tsx   # 持仓 + 订单历史
    └── error/page.tsx       # 错误页（鉴权失败 / 不在白名单等）

Provider 栈：

// app/embed/layout.tsx
<EmbedAuthProvider>      {/* SSO Token + postMessage */}
  <I18nProvider>
    <ToastProvider>
      <ApiProvider>      {/* axios with token interceptor */}
        {children}
      </ApiProvider>
    </ToastProvider>
  </I18nProvider>
</EmbedAuthProvider>

没有 `PrivyProvider`、`HybridAuth`、`SmartAccountProvider`。


---

4. 功能需求（FR）

FR-1 iframe 父子通信

FR-1.1 接收消息

// 嵌入页加载后，向 window.parent 发起 ready 消息
window.parent.postMessage({ type: 'embed:ready' }, '*');

// 监听父页消息
window.addEventListener('message', (event) => {
  // ★ 安全：严格校验 origin
  if (!ALLOWED_PARENT_ORIGINS.includes(event.origin)) {
    console.warn('Rejected message from origin:', event.origin);
    return;
  }
  switch (event.data.type) {
    case 'embed:auth':
      handleAuth(event.data);
      break;
    case 'embed:token-refresh':
      handleTokenRefresh(event.data);
      break;
    case 'embed:locale-change':
      setLocale(event.data.locale);
      break;
    case 'embed:theme-change':
      setTheme(event.data.theme);
      break;
  }
});

FR-1.2 父→子消息协议

Type
Payload
时机
embed:auth
{ token, userCode, channel, locale?, theme? }
iframe 首次加载 + ready 应答
embed:token-refresh
{ token, expiresAt }
父页主动续期


FR-1.3 子→父消息协议

Type
Payload
时机
embed:ready
{}
子页挂载完成
embed:auth-required
{ reason: 'expired'|'invalid' }
token 失效，请求父页续期
embed:resize
{ height }
内容高度变化（如展开订单详情）
embed:nav
{ path }
（可选）子页路由变化通知父页
embed:metric
{ event, payload }
业务事件埋点（下单、领取等）

FR-1.4 origin 白名单

// lib/embed/config.ts
export const ALLOWED_PARENT_ORIGINS = [
  'https://channel-a.example.com',
  'https://channel-b.example.com',
  // 来自配置 / 环境变量
];

⚠ 不可使用 '*'，严格枚举。

FR-1.5 防嵌入劫持

// embed 模式必须在 iframe 中运行
useEffect(() => {
  if (window.top === window.self) {
    // 不在 iframe 中 → 跳错误页
    router.replace('/embed/error?code=NOT_EMBEDDED');
  }
}, []);

并设置严格 CSP（[FR-9.2](#fr-9-安全)）。

FR-2 SSO Token 管理

- FR-2.1 Token 存储：内存 + sessionStorage（不存 localStorage 防 XSS 长期持留）
- FR-2.2 axios 拦截器：自动注入 `Authorization: Bearer <token>`
- FR-2.3 401 处理：发 `embed:auth-required` 给父页 → 收到 `embed:token-refresh` 后重试原请求
- FR-2.4 主动检测：每分钟检查 token 过期时间，临近过期（< 5min）主动请求续期
- FR-2.5 多 tab 同步：（嵌入页通常单 tab，可省略）

// lib/embed/auth.ts
class EmbedAuthStore {
  private token: string | null = null;
  private expiresAt: number = 0;

  setToken(token: string, expiresAt: number) { ... }
  getToken(): string | null { ... }
  isNearExpiry(): boolean { return this.expiresAt - Date.now() < 5 * 60 * 1000; }
  requestRefresh() {
    window.parent.postMessage({ type: 'embed:auth-required', reason: 'expired' }, '*');
  }
}

FR-3 鉴权握手时序

1. 父页加载嵌入页（src=https://yesono/embed/?session=xxx）
2. 嵌入页挂载 → 发 embed:ready
3. 父页收到 ready → 发 embed:auth { token, userCode, channel }
4. 嵌入页收到 auth → 调 GET /api/tob/auth/verify (Authorization: Bearer)
5. tob 返回 { ok: true, userInfo, walletAddress }
6. 嵌入页进入正常状态，加载市场 / 余额 / 持仓

FR-4 余额展示

- FR-4.1 调 `GET /api/tob/balance` 获取聚合余额
- FR-4.2 展示策略（按 [PRD-overview Q3](PRD-overview.md) 待确认）：
  - 方案 A（建议第一版）：只展示渠道账本余额（用户最熟悉），下单时校验渠道余额
  - 方案 B：展示三档（渠道 / 链上 BAC / dYdX collateral），advanced 用户可见
- FR-4.3 自动刷新：每 30s 静默刷新；下单 / 取消后立即刷新

FR-5 市场列表与详情

- FR-5.1 `GET /api/tob/market/list` 返回三类市场聚合
- FR-5.2 市场详情页：复用主站的 [components/common/](../../h2-market/components/common/) 组件，但下单按钮改为调 tob API
- FR-5.3 实时行情：dYdX 行情走 indexer WebSocket 直连（行情数据不涉及钱包，可直连）
- FR-5.4 价格更新：复用 h2-market 现有的 orderbook 和 price 推送

FR-6 下单流程（核心）

参考主站 [TradingPanel](../../h2-market/components/common/TradingPanel/) 但简化：

// embed 下单逻辑
async function placeOrder(form: OrderForm) {
  const betId = uuidv4();

  // 乐观 UI：立即显示 pending
  const pendingOrder = { betId, status: 'submitting', ...form };
  orderStore.add(pendingOrder);

  try {
    const res = await api.post('/api/tob/order/create', { betId, ...form });
    orderStore.update(betId, { status: 'placed', dydxOrderId: res.data.orderId, txHash: res.data.txHash });
    toast.success('下单成功');
    track('order_placed', { betId, market: form.market });
  } catch (err) {
    orderStore.update(betId, { status: 'failed', error: err.code });
    showError(err);  // 按 errorCode 提示
  }
}

UX 要点：
- 下单按钮 disable 直到收到响应
- 显示 loading（含进度提示："扣款中... 资金转账中... 跨链中... 下单中..."）—— 但 tob API 是同步的（一次返回最终状态），UI 只需显示 "下单中..." 即可
- 下单失败显示明确错误（不是技术错误码，是用户能理解的话术）
FR-7 取消订单 / 持仓 / 订单历史

- 调 tob API（/cancel / /order/list / /order/{betId}）
- UI 复用主站现有的 portfolio 页面组件
FR-8 亚盘足球（Allbet）

- 单独入口：/embed/allbet
- 调 /api/tob/allbet/markets 获取市场列表
- 下注：POST /api/tob/allbet/stake（流程同 FR-6）
- 领取：POST /api/tob/allbet/claim
FR-9 安全

FR-9.1 不持私钥
关键：嵌入模式完全不引入 Privy / Alchemy / Wagmi（除非纯只读用 publicClient 查行情；查钱包余额走 tob API）。前端代码里禁止出现任何形式的私钥。

FR-9.2 CSP 与 frame-ancestors

// next.config.js (embed 路由专用)
headers: async () => [
  {
    source: '/embed/:path*',
    headers: [
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Next.js 需要
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "connect-src 'self' https://api.tob.yesono https://lambda.maex.io wss://lambda.maex.io",
          "frame-ancestors https://channel-a.example.com https://channel-b.example.com",
          "frame-src 'none'",
          "object-src 'none'",
        ].join('; '),
      },
      // ⚠ 不要再设 X-Frame-Options DENY，会和 frame-ancestors 冲突
    ],
  },
],

FR-9.3 XSS 防护

- 所有用户输入用 DOMPurify 或 React 自带转义
- 渠道方传入的字段（locale / theme）严格白名单校验
- 不使用 dangerouslySetInnerHTML
FR-9.4 不在 URL 留 token

- token 仅通过 postMessage 传递
- 不要 ?token=...（防止日志、Referer 泄露）
FR-9.5 sessionStorage / 内存

- token 存内存优先，刷新页面不丢用 sessionStorage
- 离开页面（unload）清空
- 不存 localStorage
FR-10 i18n

- 嵌入模式默认根据父页传入的 locale 字段
- 文案：嵌入模式可能需要少量独立文案（如"已通过 [渠道方] 登录"），新增 namespace embed.*
FR-11 主题

- 复用主站 CSS 变量主题系统
- 接受父页 embed:theme-change 切换 light / dark
FR-12 错误处理与提示

错误页 /embed/error?code=...：

code
文案
NOT_EMBEDDED
"本页面仅可通过合作伙伴接入，请通过正确入口访问"
INVALID_ORIGIN
"来源不被允许"
AUTH_FAILED
"登录已过期，请刷新或重新登录"
MAINTENANCE
"系统维护中，请稍后再试"

业务错误（来自 tob API）：按 errorCode 映射到 i18n 文案表，不暴露原始 code。

FR-13 埋点

- embed:metric 通知父页 + 自有埋点（按需）
- 关键事件：embed_loaded、order_placed、order_cancelled、market_clicked
FR-14 性能

- 首屏关键资源 ≤ 200KB（gz）
- LCP ≤ 2.5s（中国大陆 4G 网络）
- 不在嵌入模式打包 dYdX SDK 等大依赖（行情用轻量 WebSocket 客户端）
  - 主站 dYdX SDK 是 lazy load（[lib/lazyDydxSdk.ts](../../h2-market/lib/lazyDydxSdk.ts)），嵌入模式因为不直连 dYdX 撮合，完全不打包 dYdX SDK
- 行情订阅可直接用原生 WebSocket（dYdX indexer 兼容标准 WS）
FR-15 兼容性

- 桌面 + 移动浏览器（与主站要求一致）
- iframe 嵌入：Chrome / Safari / Firefox / 微信内嵌浏览器

---

5. 非功能需求（NFR）

项
要求
LCP
≤ 2.5s
首屏 bundle
≤ 200KB gz
切换路由响应
≤ 200ms
API 调用 p95
≤ 1s
行情更新延迟
≤ 200ms
适配机型
iPhone SE / iPhone 13 / Android 6+ / 桌面 1280x800+


---

6. 数据流

[父页] ──postMessage──> [嵌入页 EmbedAuthProvider]
[嵌入页] ──HTTPS+JWT──> [tob API]
[嵌入页] ──WebSocket──> [dYdX indexer]（行情，不涉及钱包）
[父页] ←postMessage── [嵌入页]（请求续期 / 高度变化 / 埋点）


---

7. 关键文件 / 模块

新增文件清单：

h2-market/app/embed/
├── layout.tsx
├── page.tsx
├── market/[id]/page.tsx
├── allbet/[id]/page.tsx
├── portfolio/page.tsx
└── error/page.tsx

h2-market/lib/embed/
├── auth.ts                # EmbedAuthStore
├── bridge.ts              # postMessage 父子通信封装
├── config.ts              # ALLOWED_PARENT_ORIGINS, locale/theme 白名单
├── api.ts                 # axios with token interceptor
└── tracker.ts             # 埋点

h2-market/components/embed/
├── MarketList.tsx         # 嵌入版（精简）
├── OrderForm.tsx          # 调 tob API
├── BalanceBadge.tsx       # 余额展示
└── PortfolioPanel.tsx

h2-market/lib/services/tob/  # 调 tob API 的 service 函数
├── auth.ts
├── balance.ts
├── order.ts
├── allbet.ts
└── market.ts

复用主站资源（不动）：
- lib/i18n/
- lib/theme/
- components/common/（部分子组件复用）
- lib/stores/（部分 store 复用）

---

8. UI 设计要点

8.1 布局

- 嵌入页没有 header / footer / nav（节省空间）
- 主区域内容直接占满 iframe 宽高
- 高度自适应（用 ResizeObserver 通知父页 embed:resize）
8.2 色彩 / 字体

- 默认跟主站一致（CSS 变量 --accent、--bg-primary 等）
- 接受父页 embed:theme-change
8.3 关键页面

页面
关键元素
首页 /embed/
市场列表（dYdX + Allbet + Uma 混合）、搜索、筛选
市场详情 /embed/market/[id]
行情图、订单簿、下单表单、最近成交
亚盘详情 /embed/allbet/[id]
比赛信息、各队赔率、下注表单
持仓 /embed/portfolio
当前持仓 + 订单历史 + 已结算

8.4 状态指示

下单按钮的状态：
"立即下单" → "提交中..." → "下单成功" / "下单失败"

订单状态徽章：
- created / channel_deducted / funds_received / bridged_to_dydx / on_chain_placed → 统一显示"处理中"
- settled → "已结算"
- cancelled → "已取消"
- failed → "失败"
- refund_pending / bridged_back / refund_acked → "退款中" / "已退款"

---

9. 与 tob API 的接口契约

9.1 鉴权

// GET /api/tob/auth/verify
// Headers: Authorization: Bearer <token>
// Response:
{
  ok: true,
  userInfo: { userCode, channel, displayName? },
  walletAddress: { bac: '0x...', dydx: 'ba1...' }
}

9.2 余额

// GET /api/tob/balance
// Response:
{
  channelBalance: { balance: '1000.00', balanceAfter: '1000.00' },
  bacBalance:     { native: '0.05', usdt: '200.00' },
  dydxBalance:    { freeCollateral: '150.00', positions: [...] },
  stale: false
}

9.3 下单

// POST /api/tob/order/create
// Body:
{
  betId: 'uuid',
  market: 'BTC-USD',
  side: 'BUY',
  orderType: 'LIMIT',
  price: '60000',
  size: '0.1',
  betAmount: '100.00'
}
// Response:
{ betId, orderId, txHash, status: 'on_chain_placed' }

详细见 [PRD-tob-module §7](PRD-tob-module.md)。


---

10. 测试要点

10.1 单测

- postMessage origin 校验（正常 / 非法 origin）
- token 拦截器（401 触发 refresh）
- token 过期主动续期
10.2 集成测试

- 用本地 mock 父页 + mock tob API 跑端到端
- 测试 happy path + token 过期 + 父页重新发 token
10.3 跨浏览器测试

- Chrome / Safari / Firefox / 微信浏览器 / Android WebView
10.4 安全测试

- 用非白名单 origin 的父页 → 嵌入页拒绝消息
- 直接访问 /embed/ 不在 iframe → 跳错误页
- 尝试 ?token=... → 不读取
- CSP 校验（chrome devtools 看是否被拦）
10.5 性能测试

- LCP / TTI / 首屏 bundle 大小
- 内存：长时间挂着不应内存泄漏

---

11. 部署 / 上线清单

[] /embed/* 路由完成
[] ALLOWED_PARENT_ORIGINS 配置注入
[] CSP frame-ancestors 白名单与渠道方域名对齐
[] tob API 域名 / mTLS（只读 API 是 HTTPS，无 mTLS）已配置
[] 行情 WebSocket 已配置
[] CDN 已开启（Cloudflare Pages）
[] 错误监控（Sentry）已接入嵌入路由
[] 与渠道方联调通过


---

12. 验收标准

#
标准
1
嵌入页在指定渠道父页中正常加载（其他 origin 拒绝）
2
SSO Token 鉴权 happy path / 过期续期 跑通
3
下单 / 取消 / 持仓 / 历史 在 mock + 真链路下都正常
4
亚盘 / Uma 市场展示 + 下注 跑通
5
LCP ≤ 2.5s，首屏 ≤ 200KB gz
6
安全测试无 XSS / CSP 漏洞
7
主站模式（C2C）功能不受影响（回归测试通过）


---

13. 待确认事项

ID
主题
F1
余额展示策略（方案 A 渠道账本 vs 方案 B 多档）
F2
移动端适配优先级
F3
是否需要"游客模式"（未登录预览市场）
F4
父子通信协议是否需要协议版本号（v1 / v2 升级时兼容）
F5
是否需要在嵌入页支持深度链接（如 /embed/market/123）作为父页直接传入


---

14. 后续路线

- v1.0：嵌入模式上线（本期）
- v1.1：多语言文案完善
- v1.2：移动端 UX 专项优化
- v2.0：增加更多市场类型（如有）
- v2.x：父子通信 SDK 化（提供 @yesono/embed-sdk 给渠道方在父页用）