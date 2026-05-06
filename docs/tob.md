Yesono × 渠道方对接 — 总体架构与全流程 PRD

> 文档版本：v2.1（集中执行架构 · 路径精修）
> 创建日期：2026-04-27（v1.0）/ 2026-04-28（v2.0 / v2.1）
> 状态：草稿（待与 dYdX 团队 / 渠道方对齐后转 v2.2）
> 受众：全员（产品 / 后端 / 前端 / 合约 / 运维 / 安全）

> v2.0 关键变更：
> - 引入 yesono-router 重构（[PRD-router-refactor.md](PRD-router-refactor.md)），router 退化为纯订单协调器，所有"持私钥 + 链上执行"集中到 yesono-signer
> - C 端 / B 端订单上链路径统一：调用方 → router → signer → 链
- 4 Phase 渐进迁移：Phase 1 仅迁 dYdX trader，B 端可先上线
> v2.1 路径精修：
> - B 端 dYdX split / merge / redeem 也走 router（不再 tob 直调 signer）：router `ActionService` 改造为对 INTERNAL 平台按租户分流——`tenant=tob` 走后端执行（router 调 signer），`tenant=c-end` 仍标记 CLIENT_EXECUTE 让前端处理
- tob 直接调 signer 仅限非订单类操作：跨链 / Allbet stake/claim/createMarket / Uma batchInitialize / sweep / EIP-712 签名
> - **B 端订单核心表 `order_aggregated/order_sub` 由 router INSERT**（tob 不直接写订单核心表，仅维护 `tob_order_meta` 业务侧字段）


---

0. 文档地图

文档
受众
路径
| 本文档 — 总体架构与全流程 | 全员 | `tob-api/docs/PRD-overview.md` |
| 签名平台总体（多租户） | 平台架构师 / TS 后端 | tob-api/docs/PRD-signer-platform.md |
| 签名平台 tob 模板 | TS 后端 | tob-api/docs/PRD-signer-tob-module.md |
| 签名平台接入指南 | 所有调用方（Java/TS/Python/Go）| `tob-api/docs/signer-integration-guide.md` |
| prediction-market-service-tob module | Java 后端 | tob-api/docs/PRD-tob-module.md |
| h2-market 嵌入模式 | 前端 | tob-api/docs/PRD-frontend.md |
| yesono-router 重构（v2） | router 维护者 / TS 后端 | `tob-api/docs/PRD-router-refactor.md` |


---

1. 业务背景

Yesono 是部署在自建 EVM 链（BAC 链，chainId `66666`）上的预测市场。撮合引擎是自部署 dYdX 链（v4 fork：`@h2protocol/v4-client-js`，chainId `ba-mainnet`），dYdX 团队已开发 BAC ↔ dYdX 跨链桥。

现需对接 B 端渠道方（"现金网"）：

- 渠道方有自己的法币/积分账本与登录体系
- 渠道方将 Yesono 前端通过 iframe 嵌入到自己的页面里供用户使用
- 渠道方在 BAC 链上自管 EOA 钱包（私钥归渠道方），作为资金池对外转账
- 用户在渠道方下注 → 渠道方扣本地账本余额 → 渠道方 EOA 上链给用户钱包转 USDT → Yesono 跨链到 dYdX → 在 dYdX 撮合引擎下单
- 用户取消/结算后 → dYdX 端跨链桥直接打回渠道方 EOA → Yesono 调渠道方 /cancelBet 或 /winLoss → 渠道方账本回滚或结算
已确认的核心选型：

- 资金方案：EOA 方案（不再使用多签合约方案）
- 用户钱包：Yesono 托管 EOA，每渠道+用户派生独立地址，私钥由 signer 在 KMS 内保管
- 钱包池：tob 租户分四池（user / operator / admin / gas-tank）
- 退款策略：懒归集（默认静默 10 min，兜底 1h）
- 跨链桥：BAC 端桥合约由用户已开发完成（不在本计划范围）；dYdX 端跨链 RPC 由 dYdX 团队负责
- 链上凭证：以 BAC 链 receipt 为准（精确校验 from / to / token / amount / confirmations）。EOA 方案下 receipt 本身就是密码学不可伪造的非否认证据（渠道用自己私钥发的链上 tx），不要求渠道方再额外返回 EIP-712 签名。`/bet` 接口的 HTTPS + HMAC + receipt 校验三层已足够

复用主站资产：

- 前端：[h2-market/](../../h2-market/) — Next.js 14，dYdX SDK 集成 + 跨链桥 + AllbetMarketV1 + UmaCtfAdapter + Privy/AA 智能账户全部已实现
- 后端：[prediction-market-service/](../../prediction-market-service/) — Spring Boot 多模块，含 bachain-sdk-java、订单聚合、JWT、PostgreSQL、@Scheduled

---

2. 总体架构

2.1 组件视图（v2 集中执行架构）

渠道方域：
  渠道方前端 ─iframe─ Yesono 嵌入页    渠道方服务器（持渠道 EOA 私钥 + 9 个钱包接口）
       │                                       ↑
       │ SSO Token                             │ HTTPS + HMAC（tob 调）
       │                                       │
═══════│═══════════════════════════════════════│═══════════════════════════════
       │                                       │
Yesono 域：                                    │
       ▼                                       │
  ┌─────────────────────┐                      │
  │ h2-market（前端）    │                      │
  │  C 端：主站模式       │                      │
  │  B 端：/embed/* 嵌入 │                      │
  └────┬────────────────┘                      │
       │                                       │
   ┌───┴────┐                                  │
   │        │                                  │
   ▼        ▼                                  │
 (主站)    POST /api/tob/...        ┌──────────┘
   │         │                      │
   │         ▼                      ▼
   │     ┌──────────────────────────────────┐
   │     │ prediction-market-service-tob     │
   │     │ （新增 Java module，无私钥）       │
   │     │  • 渠道方 9 接口对接               │
   │     │  • 订单状态机（渠道侧 + 跨链中间态）│
   │     │  • 链上 receipt 校验               │
   │     │  • 懒归集 / 对账                   │
   │     └────┬──────────────────────┬─────┘
   │          │ HTTPS（创建订单）       │ mTLS（split/merge/redeem
   │          │                       │  + 创建市场 + 跨链 + sweep）
   │          ▼                       │
   ▼     ┌──────────────────────┐     │
   └────→│ yesono-router        │     │
         │ （重构：纯订单协调）   │     │
         │  • /order/create      │     │
         │  • 订单拆分 + 入队     │     │
         │  • 状态同步任务（30s）│     │
         │  • 不持私钥（重构后）  │     │
         └──────────┬───────────┘     │
                    │ mTLS（链上执行） │
                    ▼                  ▼
                 ┌────────────────────────────────────────┐
                 │ yesono-signer（新建独立 TS）            │
                 │  ★ 集团唯一执行层                       │
                 │  ★ 多租户：c-end / tob / 量化 / 机器人 │
                 │  • KMS / HSM 私钥管理                  │
                 │  • dYdX SDK / Polymarket CLOB SDK     │
                 │  • 跨链桥（BAC↔dYdX、POL→BAC）         │
                 │  • CTF Split / Merge / Redeem         │
                 │  • AllbetMarketV1 / UmaCtfAdapter      │
                 │  • EIP-712 签名（CheckMarket 等）      │
                 │  • Gas-tank（多链）                    │
                 │  • Nonce / 限额 / 审计                 │
                 └─────────────┬────────────────┬───────┘
                               │                │
                               ▼                ▼
                          BAC 链            dYdX / Polygon
                                            等其他链

主站 Postgres（所有项目共用）：users / markets / order_aggregated / order_sub /
  bk_user_balances / bk_user_chain_transactions / bk_user_create_market_record / tob_*

扫链服务（独立项目）：写 bk_user_*（按 EOA 地址索引到 user_id）

2.1.1 关键调用路径

C 端下单（router 重构 Phase 2 完成后）：
h2-market → router /order/create → 拆分 + 入队 → OrderExecutionWorker
                                                  → signer.Trade.PlaceOrder
                                                  → KMS 签 + 上链
                                                  → 回写 router 订单 status/txHash

B 端下单（router 重构 Phase 1 起即可）：
嵌入页 → tob /api/tob/order/create
        → tob 调渠道方 /bet
        → tob receipt 校验
        → tob 调 router /order/create（带 X-Tenant: tob 等 header）
        → router 拆分 + 入队 → OrderExecutionWorker（识别 tob 租户）
        → signer.Trade.PlaceOrder
        → KMS 签 + 上链

B 端 Split / Merge / Redeem（v2.1：router 按租户分流，B 端走后端执行）：
tob → router /order/split → router ActionService 落 ActionSubOrder
                              ↓ tenant=tob → status=PENDING（后端执行）
                              ↓ executeBackendActions 出队
                              ↓ router 调 signer.Trade.CtfSplit/Merge/Redeem
                              ↓ signer KMS 签 + 上链
                              ↓ router 回写 ActionSubOrder.txHash / status=COMPLETED
                              ↓ tob 通过 router /order/{id} 查状态
注：C 端 INTERNAL 仍走 CLIENT_EXECUTE 让前端执行，零改动。

B 端 跨链 / 创建市场 / sweep / EIP-712 签名（不经 router，tob 直接调 signer）：
tob → signer.Bridge.* / signer.Tob.AllbetCreateMarket / signer.Tob.UmaBatchInitialize
     / signer.Refund.SweepBacResidual / signer.Tob.AllbetSignCheckMarket
当前 router 不管理这些（Allbet / Uma 不在 router 订单体系；跨链 / sweep 不属于"订单"概念；纯签名不上链）。

2.2 资金流（USDT）

渠道方 EOA ──直接转账──> BAC 用户 EOA ──跨链──> dYdX 用户账户 ──下单/结算──> dYdX 持仓
                                                            │
                                                            ▼
                                       dYdX 跨链 RPC ──跨链──> BAC 渠道方 EOA
                                                            │
                                                            ▼
                                                  调 B 端 cancelBet / winLoss
                                                  渠道方账本结算

2.3 信息流（订单）

前端嵌入页 ─下单请求→ tob ─/bet→ 渠道方 ─返回 txHash→ tob ─链上 receipt 校验→ tob
  │                                                                              │
  │                                                                              ▼
  │                                                                      tob ─跨链→ signer
  │                                                                              │
  │                                                                              ▼
  │                                                                      signer ─下单→ dYdX
  │                                                                              │
  ◀─────────────── 订单状态推送（轮询 / WebSocket） ◀──────────────── tob 索引/对账

2.4 项目部署形态

组件
部署形态
暴露面
持私钥
h2-market（嵌入模式）
Cloudflare Pages，新增 /embed/* 路由
公网（被 iframe 嵌入）
❌
prediction-market-service-tob
主站 Spring Boot 集群新增 module
公网（前端 + 渠道回调）
❌
yesono-signer
独立 VPC，K8s 多副本
仅内网 + mTLS
✅（用户托管 EOA + operator + admin + gas-tank）
BAC 链合约
已部署
链上
—


---

3. 全流程时序图

3.1 流程总览

流程
章节
用户登录 + iframe 嵌入 + 鉴权
§3.2
用户下单（核心）
§3.3
dYdX 下单后撮合 + 持仓
§3.4
用户取消订单（懒归集）
§3.5
订单结算（winLoss）
§3.6
异常分支：跨链失败 / 链上验证失败
§3.7
亚盘足球：用户下注 / 领取（AllbetMarketV1）
§3.8
平台方：批量创建市场（UmaCtfAdapter）
§3.9
平台方：CheckMarket EIP-712 签名（AllbetMarketV1）
§3.10
渠道方主动重发：winLossRepeat / winLossModifyRepeat
§3.11
每日对账
§3.12


---

3.2 用户登录 + iframe 嵌入 + 鉴权
暂时无法在Lark文档外展示此内容

关键点：

- SSO Token 由渠道方签发，tob 解 JWT 后可选反查 `/auth/verify`（建议第一版反查保险）
- 嵌入页严格校验 event.origin 防 iframe 劫持
- 钱包地址在用户首次登录时懒派生（首访时 Wallet.Derive 才创建）
- 余额聚合：渠道账本 + BAC USDT + dYdX freeCollateral 三者一并返回

---

3.3 用户下单（核心流程，v2 经 router 中转）
暂时无法在Lark文档外展示此内容

关键校验点：

1. /bet 调用幂等：`betId` 全局唯一，重复调用 `/bet` tob 直接返回上次结果
2. Receipt 校验是 EOA 方案的安全核心：渠道方任何返回的 txHash 都必须经链上验证全字段匹配，否则状态停留 channel_deducted 不进 funds_received
3. 跨链到账确认：BAC `initiateBridge` 上链 ≠ dYdX 到账，必须有 dYdX 端到账确认信号才推 bridged_to_dydx
4. router 是订单核心表的写入方：tob 不直接 INSERT `order_aggregated/order_sub`，调 router `/order/create` 由 router 落表，tob 仅在 `tob_order_meta` 落业务侧字段（betId / channel_tx_hash / refund 状态等）
5. router → signer 是同步调用：OrderExecutionWorker 阻塞等待 signer 返回 txHash 才更新 status；signer 不可用时订单卡在 PENDING（不本地降级签名）
6. 下单失败的回滚：见 §3.7 异常分支


---

3.4 dYdX 下单后撮合 + 持仓更新

dYdX 撮合是异步的：placeOrder 返回 orderId 不代表已撮合。
暂时无法在Lark文档外展示此内容

说明：dYdX 订单簿是中心化撮合（虽然结算在链上），用 Indexer WebSocket 订阅订单状态最高效；本期 tob 用轮询 indexer 也可以（每 2-3 秒轮一次），降低实现复杂度。


---

3.5 用户取消订单（懒归集）
暂时无法在Lark文档外展示此内容

懒归集策略：

trigger_at = max(
  order.refund_marked_at + IDLE_WINDOW,       // 此订单标记退款后的静默期
  user_wallet.last_active_at + IDLE_WINDOW    // 整个用户钱包的活跃静默
)
MAX_HOLD = 1h  // 兜底，无论是否活跃必须归集

- 默认 IDLE_WINDOW = 10min、MAX_HOLD = 1h，配置化
- 同一 userCode 的多笔 refund_pending 订单聚合为一笔 BridgeBackToBac，一次跨链 + 多次 cancelBet
- ⚠ 待确认（Q1/Q2）：渠道方是否能接受"调 cancelBet 时间晚于订单状态变化时间"，以及在懒归集窗口内 `playerBalance` 应返回什么


---

3.6 订单结算（winLoss）

dYdX 端订单成交并结算后：
暂时无法在Lark文档外展示此内容

关键：
- modifyBalance 计算：以 dYdX 端实际成交后用户净盈亏为准（freeCollateral 变化）
- invalidBetIdList：当某些下注因为撮合失败/无效成为"无效注单"时，按 [b端对接示例.md:5-11](b端对接示例.md) 处理（标记 invalid，等后续 cancelBet 才退款）
- uuid：余额变动流水，全局唯一，作 winLossRepeat 幂等键

---

3.7 异常分支

3.7.1 链上验证失败（receipt.from 不在白名单 / 金额不匹配 / 确认数不足）

状态: channel_deducted (停留)
→ 重试 N 次拉 receipt 仍不通过 → 进入人工核对队列
→ 通知运维 + 联系渠道方对账

不会自动推到 funds_received，资金安全优先。

3.7.2 跨链卡单（BAC → dYdX）

状态: funds_received → 触发 BridgeToDydx
→ BAC lock 上链成功，但 dYdX 端长时间未到账（超时 30min）
→ 状态停留 funds_received
→ 进入"残留兜底"分支:
   1. signer.SweepBacResidual (用户 BAC EOA 仍有 USDT，转回渠道 EOA)
   2. tob 调 /cancelBet
   3. 状态推到 refund_acked

3.7.3 dYdX 下单失败

状态: bridged_to_dydx → 调 PlaceOrder 失败
→ 进入"残留兜底"分支:
   1. signer.BridgeBackToBac (dYdX 余额跨回 BAC 渠道 EOA)
   2. tob 调 /cancelBet
   3. 状态推到 refund_acked


---

3.8 亚盘足球：用户下注 / 领取（AllbetMarketV1）

亚盘足球市场是 BAC 链上撮合（不经过 dYdX），合约是 `AllbetMarketV1`。

sequenceDiagram
    participant U as 用户
    participant YF as Yesono 嵌入页
    participant TOB as tob 后端
    participant CS as 渠道方服务器
    participant CEOA as 渠道方 EOA
    participant SG as signer
    participant BAC as BAC 链
    participant ALL as AllbetMarketV1

    Note over U,YF: 下注流程
    U->>YF: 选比赛 + 选队 + 输金额 + 下注
    YF->>TOB: POST /api/tob/allbet/stake<br/>{betId, marketId, itemId, amount}
    TOB->>CS: /bet
    CS->>CEOA: USDT.transfer(userBacEoa, amount)
    CEOA->>BAC: tx
    CS-->>TOB: txHash + EIP-712
    TOB->>BAC: receipt 校验
    Note over TOB: funds_received
    TOB->>SG: Tob.AllbetStake(userCode, marketId, itemId, amount)
    SG->>ALL: AllbetMarketV1.stake(marketId, itemId, amount)
    ALL->>BAC: tx
    BAC-->>SG: receipt
    SG-->>TOB: txHash
    Note over TOB: on_chain_placed
    TOB-->>YF: 下注成功

    Note over U,YF: 比赛结束 → 领取流程
    Note over TOB: dYdX 不参与，<br/>在 BAC 上直接领取

    U->>YF: 点"领取奖励"
    YF->>TOB: POST /api/tob/allbet/claim<br/>{marketIds, teamIds}
    TOB->>SG: Tob.AllbetClaim(userCode, marketIds, teamIds)
    SG->>ALL: AllbetMarketV1.claim(uint64[] marketIds, uint8[] itemIds)
    ALL->>BAC: tx (转 USDT 回用户 EOA)
    Note over SG: ⚠ marketId 必须 BigInt<br/>(uint64 超 JS Number.MAX_SAFE_INTEGER)
    BAC-->>SG: receipt
    SG-->>TOB: txHash + 领取金额
    TOB->>TOB: 标记 settled, refund_pending<br/>winLossId = 派生
    Note over TOB: 触发懒归集 → BridgeBackToBac (亚盘也走渠道 EOA 归集)<br/>实际上亚盘奖励直接到用户 EOA，不需要 dYdX 跨链
    TOB->>SG: Refund.SweepBacResidual<br/>(用户 EOA → 渠道 EOA)
    TOB->>CS: /winLoss
    Note over TOB: refund_acked
    TOB-->>YF: 已领取 + 已结算

注意：

- 亚盘足球不经过 dYdX，资金路径是：渠道 EOA → 用户 EOA → AllbetMarketV1（stake）→ AllbetMarketV1（claim 出钱）→ 用户 EOA → 懒归集 → 渠道 EOA
- claim 是批量调用：`claim(uint64[] _marketIds, uint8[] _itemIds)`，marketId 必须用 bigint（合约是 uint64，超 JS Number.MAX_SAFE_INTEGER 会被 ABI 编码错乱）
- stake 调用前不需要 USDT.approve（合约用 native value 接收？参考 h2-market useAllbetMarket.ts:520-541 实现，需在 PRD-signer-tob-module 内细化）

---

3.9 批量创建市场（UmaCtfAdapter）

UmaCtfAdapter.batchInitialize / batchInitializeCustom 支持两类发起方：

发起方
资金来源
调用入口
signer 钱包池
| B 端普通用户 | 用户钱包内的 USDT（reward × markets.length 由用户自付）| `/api/tob/market/uma/create` | `tob:user`（即用户托管 EOA）|
| 平台运营 | 平台 admin 钱包内的 USDT | `/admin/tob/uma/batch-initialize` | `tob:admin` |

两条路径合约层一致，差异在：扣款来源、是否走 B 端 /bet 接口、调用 signer 时使用哪个钱包池。

3.9.1 用户发起（B 端用户在前端创建市场）
暂时无法在Lark文档外展示此内容

3.9.2 平台发起（运营后台批量开盘）
暂时无法在Lark文档外展示此内容
3.9.3 通用关键点

- batchInitialize vs batchInitializeCustom：体育类用 Custom（无 liveness 参数）；其他用 batchInitialize
- ⚠ 已部署市场再次 batchInitialize 会 revert `QuestionAlreadyInitialized`，调用前 tob 必须按 questionId 过滤已初始化的（参考 h2-market `CLAUDE.md`）
- USDT 授权策略：用户钱包 / admin 钱包均建议第一次 max approve 一次（命中 allowance 缓存后续跳过）
- 事件解析：监听 QuestionInitialized 事件回写 questionId 到 tob 数据库
- ⚠ 用户路径必须走 receipt 校验：和普通下单一致，`/bet` → 校验 from/to/amount → 才能继续；admin 路径直接动 admin 钱包，不走 `/bet`


---

3.10 创建亚盘市场（AllbetMarketV1）+ CheckMarket EIP-712 签名

AllbetMarketV1.createMarket 也支持两类发起方：

发起方
createMarket 资金来源（bondAmount + stakeAmount）
调用入口
signer 钱包池
| B 端普通用户 | 用户钱包 | `/api/tob/allbet/market/create` | `tob:user` |
| 平台运营 | admin 钱包 | `/admin/tob/allbet/create-market` | `tob:admin` |

重要：无论谁发起 `createMarket`，**`CheckMarket` EIP-712 签名都由项目方 `operator` 钱包签**（这是平台对市场的"准入授权"凭证，确保只有合规市场才能创建，即使用户发起也必须先取得平台签名）。

合约里 `CheckMarket.creator` 字段含义：实际发起 createMarket 的地址（用户路径 = 用户 EOA；运营路径 = admin EOA），不是 operator。signer 内部用 operator 私钥签，但 message 里写发起方地址。

3.10.1 用户发起（B 端用户在前端创建亚盘市场）

sequenceDiagram
    participant U as 用户
    participant YF as Yesono 嵌入页
    participant TOB as tob 后端
    participant CS as 渠道方服务器
    participant CEOA as 渠道方 EOA
    participant SGu as signer (user pool)
    participant SGo as signer (operator pool)
    participant ALL as AllbetMarketV1
    participant BAC as BAC 链

    U->>YF: 配置市场（球队、起止时间、minStakeAmount …）+ 提交
    YF->>TOB: POST /api/tob/allbet/market/create<br/>{betId, marketParams, totalCost = bondAmount + stakeAmount}
    Note over TOB: 状态: created

    TOB->>CS: /bet（betAmount = totalCost）
    CS->>CEOA: USDT.transfer 或原生币转账（按 T1 待确认）
    CEOA->>BAC: tx
    CS-->>TOB: { returnCode:0, txHash }
    TOB->>BAC: receipt 校验
    Note over TOB: 状态: funds_received

    Note over TOB: 取 createMarket 在合约里的 nonce
    TOB->>SGu: Wallet.GetAddress(channel, userCode) → userEoa
    TOB->>SGu: read AllbetMarketV1.nonce(userEoa)
    SGu-->>TOB: nonce

    Note over TOB,SGo: 由 operator 钱包签 CheckMarket（creator=用户 EOA）
    TOB->>SGo: Tob.AllbetSignCheckMarket(<br/>  minStakeAmount, marketId, creator=userEoa, nonce)
    SGo->>SGo: KMS 内 signTypedData<br/>(domain.verifyingContract=AllbetMarketV1)
    SGo-->>TOB: signature (0x...)

    Note over TOB: 调用 createMarket，发起方 = 用户 EOA
    TOB->>SGu: Tob.AllbetCreateMarket(userPool,<br/>  bondAmount, stakeAmount, ..., signature, marketType)
    SGu->>ALL: createMarket(...) {value: bondAmount + stakeAmount}<br/>tx.from = userEoa
    ALL->>BAC: tx
    BAC-->>SGu: receipt
    Note over TOB: 状态: on_chain_placed
    TOB-->>YF: 创建成功 + marketId

3.10.2 平台发起（运营后台创建市场）

sequenceDiagram
    participant OPS as 运营后台
    participant TOB as tob 后端
    participant SGa as signer (admin pool)
    participant SGo as signer (operator pool)
    participant ALL as AllbetMarketV1

    OPS->>TOB: 请求创建（admin 鉴权）<br/>{minStakeAmount, marketId, ...}
    TOB->>SGa: read AllbetMarketV1.nonce(adminEoa)
    TOB->>SGo: Tob.AllbetSignCheckMarket(<br/>  ..., creator=adminEoa, nonce)
    SGo-->>TOB: signature
    TOB->>SGa: Tob.AllbetCreateMarket(adminPool,<br/>  ..., signature)
    SGa->>ALL: createMarket(...) {value: bondAmount + stakeAmount}
    ALL-->>SGa: receipt
    SGa-->>TOB: txHash + marketId
    TOB-->>OPS: 创建成功

3.10.3 通用关键点

- ⚠ operator 钱包签的 message.creator 必须等于实际发起 createMarket 的地址（user 路径用 userEoa，admin 路径用 adminEoa），否则合约 `_recoverSigner` 校验失败
- ⚠ **h2-market 当前从 `NEXT_PUBLIC_PRIVATE_KEY` 读 operator 私钥做签名**（[useAllbetMarket.ts:426-431](../../h2-market/components/hooks/useAllbetMarket.ts)），生产必须立即下线，全部走 signer。前端无需也无权直接拿 signature，统一让 tob 调 signer 后由 tob 把 signature 拼进 createMarket 调用
- nonce 由合约管理：`AllbetMarketV1.nonce(creator)`，每签一次 +1。取 nonce 与发签名要同事务/原子化，避免高并发下用同 nonce 签出两个 signature
- value = bondAmount + parsedStakeAmount（具体语义见 [T1 待确认](#9-待确认事项汇总)）
- 用户路径同样要走 receipt 校验，admin 路径不走 /bet

---

3.11 渠道方主动重发：winLossRepeat / winLossModifyRepeat

按 [b端对接示例.md:161-294](b端对接示例.md) 协议，渠道方对 winLoss / winLossModify 做超时重发：

sequenceDiagram
    participant CS as 渠道方服务器
    participant TOB as tob 后端

    CS->>TOB: POST /winLossRepeat (HMAC)<br/>{siteCode, winLossList:[{uuid, ...}]}
    TOB->>TOB: 按 uuid 查 settlement_log
    alt uuid 已处理
        TOB-->>CS: { returnCode:0 }<br/>不再处理（幂等）
    else uuid 未处理
        TOB->>TOB: 处理（modifyBalance、modifyBalanceAfter）<br/>记录 uuid
        TOB-->>CS: { returnCode:0 }
    end

幂等键：`uuid`（余额变动流水 ID）。


---

3.12 每日对账

sequenceDiagram
    participant J as ReconJob (Spring @Scheduled, ShedLock)
    participant TOB as tob DB
    participant CS as 渠道方
    participant SG as signer
    participant BAC as BAC 链
    participant DYX as dYdX 链

    Note over J: 每天 02:00（凌晨低峰）

    J->>TOB: 查昨天所有订单 + 流水
    J->>CS: 拉昨天 /playerBalance 历史<br/>（如果渠道有提供历史接口）
    J->>SG: 查所有用户钱包链上余额（BAC + dYdX）
    J->>BAC: 查 USDT Transfer 事件（渠道EOA <-> 用户EOA）
    J->>DYX: 查所有用户的 fill / settlement 事件

    J->>J: 对账：<br/>- 订单状态 vs 链上事件<br/>- modifyBalance 累加 vs 渠道账本变动<br/>- 用户钱包链上余额 vs DB 缓存<br/>- 跨链 lock/release 总和

    alt 有差异
        J->>J: 写 recon_alert 表 + 触发 PagerDuty
    else 无差异
        J->>J: 写 recon_pass
    end


---

4. 订单状态机（含异常分支）

┌─────────┐
│ created │
└────┬────┘
     │ /bet 成功 + 渠道返回 txHash
     ▼
┌──────────────────┐
│ channel_deducted │── /bet 失败 ──→ failed
└────┬─────────────┘
     │ 链上 receipt 校验通过（from/to/amount/confirm）
     ▼
┌────────────────┐         校验失败 N 次（金额错/from错/confirm 不足）
│ funds_received │──────────────────────────────────────────────→ manual_review
└────┬───────────┘
     │ 触发 BridgeToDydx
     ▼
┌──────────────────┐         跨链超时（30min）
│ bridged_to_dydx  │─────────────────────────→ refund_pending → bridged_back → refund_acked
└────┬─────────────┘                               (Sweep BAC 残留 + cancelBet)
     │ 调 PlaceOrder
     ▼
┌──────────────────┐         下单失败
│ on_chain_placed  │─────────────────────────→ refund_pending → bridged_back → refund_acked
└────┬─────────────┘                               (BridgeBackToBac + cancelBet)
     │ dYdX 撮合 (filled / cancelled / expired / settled)
     ▼
┌────────────┬───────────┬───────────┬────────┐
│  settled   │ cancelled │  expired  │ failed │
└─────┬──────┴─────┬─────┴─────┬─────┴────────┘
      └────────────┼───────────┘
                   ▼
           ┌────────────────┐
           │ refund_pending │  懒归集等待中
           └────────┬───────┘
                    │ trigger_at 到达
                    ▼
           ┌────────────────┐
           │ bridged_back   │  dYdX → BAC 渠道 EOA
           └────────┬───────┘
                    │ 调 cancelBet (取消) or winLoss (结算)
                    ▼
           ┌────────────────┐
           │ refund_acked   │  终态
           └────────────────┘

状态字段定义

状态
含义
持续时间预期
created
订单已收到，未调 /bet
<1s
channel_deducted
/bet 已成功，等链上验证
数秒
funds_received
链上 receipt 已通过校验
<1s
bridged_to_dydx
跨链已确认到达 dYdX
<30s
on_chain_placed
dYdX 下单成功，等撮合
几秒到几小时
settled / cancelled / expired / failed
dYdX 端结果
终态（前置）
refund_pending
等懒归集
10min ~ 1h
bridged_back
跨链回 BAC 渠道 EOA 已确认
<30s
refund_acked
B 端结算/取消已确认
终态
manual_review
人工介入（异常）
不限


---

5. 接口契约清单

5.1 接口总览（v2）

方向
调用方
被调方
协议
列表
①
渠道前端
Yesono 嵌入页
postMessage
SSO Token 交换、token 续期
②
Yesono 嵌入页
tob 后端
HTTPS + JWT
/api/tob/auth/* /order/* /balance /wallet /allbet/* /market/*
③
tob 后端
渠道方服务器
HTTPS + HMAC
/playerBalance /bet /cancelBet /winLoss /winLossRepeat /winLossModify /winLossModifyRepeat /tip /auth/verify
④
渠道方服务器
tob 后端
HTTPS + HMAC
（回调）winLossRepeat 等的请求方向
| ⑤ | tob 后端 | yesono-router | HTTPS + JWT | /order/create /order/cancel /order/split /order/merge /order/redeem /order/{id} |
| ⑥ | tob 后端 | signer | gRPC + mTLS | Wallet.Derive / Wallet.Balance / Bridge.* / Tob.Allbet* / Tob.Uma* / Refund.SweepBacResidual / Tob.AllbetSignCheckMarket（仅非订单类；split/merge/redeem 不再由 tob 调）|
| ⑦ | yesono-router | signer | gRPC + mTLS | Trade.PlaceOrder / Trade.CancelOrder / Wallet.GetAddress / 其他执行类（router 内 OrderExecutionWorker 调）|
| ⑧ | signer | BAC / dYdX / Polygon 链 | EVM JSON-RPC / Cosmos / SDK | placeOrder / cancelRawOrder / bridgeTransfer / 各类合约 call |
| ⑨ | 扫链服务（已有）| 主站 Postgres | JDBC | 直接 INSERT bk_user_balances / bk_user_chain_transactions / bk_user_create_market_record |

详细接口定义在各项目 PRD 中。本文档列总览。

5.2 ② 嵌入页 ↔ tob 后端 API 总览

Method
Path
说明
POST
/api/tob/auth/verify
SSO Token 校验
GET
/api/tob/auth/refresh
Token 续期
GET
/api/tob/balance
聚合余额（渠道 + BAC + dYdX）
GET
/api/tob/wallet/address
返回用户 BAC EOA + dYdX 地址
GET
/api/tob/market/list
市场列表（dYdX + 亚盘 + Uma 聚合）
| POST | **`/api/tob/market/uma/create`** | 用户批量创建 Uma 市场（batchInitialize / Custom） |
| POST | /api/tob/order/create | 下单（dYdX 路径）|
| POST | /api/tob/order/{betId}/cancel | 取消订单 |
| GET | /api/tob/order/list | 用户订单列表 |
| GET | /api/tob/order/{betId} | 订单详情 |
| POST | /api/tob/allbet/stake | 亚盘下注 |
| POST | /api/tob/allbet/claim | 亚盘领取 |
| GET | /api/tob/allbet/markets | 亚盘市场列表 |
| POST | **`/api/tob/allbet/market/create`** | 用户创建亚盘市场（含 CheckMarket EIP-712 + createMarket） |

管理后台 API（admin 鉴权，不在公开前端暴露）：

Method
Path
说明
POST
/admin/tob/uma/batch-initialize
平台 admin 批量创建 Uma 市场
POST
/admin/tob/uma/batch-initialize-custom
平台 admin 批量创建体育类（无 liveness）
POST
/admin/tob/allbet/create-market
平台 admin 创建亚盘市场
POST
/admin/tob/allbet/withdraw-bond
平台 admin 提取保证金

5.3 ③ tob ↔ 渠道方 API 总览

按 [b端对接示例.md](b端对接示例.md) 实现 9 个接口：

接口
方向
幂等键
说明
/playerBalance
tob → 渠道
userCode
查询余额
/bet
tob → 渠道
betId
下注扣款
/cancelBet
tob → 渠道
betId
取消退款
/winLoss
tob → 渠道
uuid
结算
/winLossRepeat
渠道 → tob
uuid
结算重发
/winLossModify
tob → 渠道
uuid
结算修改
/winLossModifyRepeat
渠道 → tob
uuid
结算修改重发
/tip
tob → 渠道
tipId
小费

5.4 ⑤ tob ↔ signer gRPC 总览

详见 [PRD-signer-platform.md](PRD-signer-platform.md) 与 [PRD-signer-tob-module.md](PRD-signer-tob-module.md)。


---

6. 安全架构总览

6.1 私钥分布

私钥
所有方
存储位置
渠道方 EOA 私钥
渠道方
渠道方自有（不在 Yesono 体系内）
用户托管 EOA
Yesono
signer KMS
Operator 钱包（CheckMarket 签名）
Yesono
signer KMS
Admin 钱包（市场创建）
Yesono
signer KMS
Gas-tank EOA
Yesono
signer KMS
dYdX 用户账户私钥
Yesono（同 EVM 私钥派生）
signer KMS

6.2 信任链与防御纵深

[攻击者]
  │
  ├─ 攻击渠道方前端 → 拿不到 token（HttpOnly）+ origin 校验拦截
  ├─ 攻击 Yesono 嵌入页 → CSP 限制 + 不持私钥
  ├─ 攻击 tob 后端 → 不持私钥；只能影响业务编排，无法直接出资金
  ├─ 攻击 signer 入口 → mTLS + API key + 多租户隔离 + 限额 + 审计告警
  ├─ 攻击 KMS → 需要 KMS provider 自身被攻破（极低概率）+ Yesono 账号控制权
  └─ 链上重放 / 伪造 → betId 唯一 + receipt 全字段校验 + 渠道EOA 白名单

6.3 关键安全防线（按重要性排序）

1. 链上 receipt 校验：渠道方任何返回的 txHash 都要经过 from/to/token/amount/confirmations 五项校验，是 EOA 方案的资金安全核心
2. 渠道 EOA 白名单：每个 channel 配置中绑定唯一 EOA，from 不在白名单直接拒绝
3. 私钥单点持有：除签名服务外的任何组件被攻破，私钥不会泄漏
4. 多租户隔离：KMS partition + DB tenant_id + mTLS + 网关路由四层叠加
5. 限额与告警：每租户独立限额池 + 异常行为基线 + 三级冻结开关
6. B 端接口防重放：timestamp + nonce + HMAC + 5min 窗口
7. 订单幂等：betId 全局唯一 + uuid 流水唯一


---

7. 配置项（关键）

tob 后端

配置
默认值
说明
tob.channel.[channelCode].siteCode
—
渠道签发的 siteCode
tob.channel.[channelCode].channelEoaAddress
—
渠道方 EOA 白名单地址
tob.channel.[channelCode].walletServerUrl
—
渠道钱包接口地址
tob.channel.[channelCode].hmacSecret
—
与渠道方互调的 HMAC 密钥
tob.channel.[channelCode].ssoVerifyUrl
—
渠道方 /auth/verify 地址（可选）
tob.bac.rpc
—
BAC 链 RPC
tob.bac.usdt
—
BAC 链 USDT 合约地址
tob.bac.confirmations
6
链上确认块数
tob.bac.allbetMarket
—
AllbetMarketV1 地址
tob.bac.umaCtfAdapter
—
UmaCtfAdapter 地址
tob.bac.bridgeAddress
—
BAC 端 Bridge 合约地址（initiateBridge / initiateBridgeCtf）
tob.bac.dydxRemoteChainId
—
uint64，与 dYdX 团队约定的 remoteChainId
tob.dydx.indexerRest
—
dYdX indexer REST
tob.dydx.indexerWs
—
dYdX indexer WS
tob.dydx.validatorRpc
—
dYdX validator RPC
tob.dydx.chainId
ba-mainnet
dYdX 链 ID
tob.signer.endpoint
—
signer gRPC 地址
tob.signer.tlsCert
—
mTLS 客户端证书
tob.refund.idleWindowMin
10
懒归集静默窗口
tob.refund.maxHoldMin
60
懒归集兜底

signer

配置
默认值
说明
signer.tenants.tob.kmsKeyringId
—
tob 租户 KMS keyring
signer.tenants.tob.allowedCallerCerts
[]
允许调用的 mTLS 证书指纹
signer.tenants.tob.dailyLimit
100000 USDT
日累计签名上限
signer.tenants.tob.txPerSecond
10
QPS 限制
signer.kms.provider
aws-kms
aws-kms / aliyun-kms / vault
signer.audit.exporter
siem
siem 输出
signer.bac.rpc
—
BAC 链 RPC
signer.dydx.*
—
dYdX 接入点


---

8. 术语表

术语
含义
渠道方 / B 端
接入 Yesono 的现金网客户
siteCode
渠道方在 Yesono 系统中的唯一标识
userCode
用户在渠道方系统中的唯一标识
betId
单笔下注的全局唯一 ID（幂等键）
uuid
余额变动流水 ID（结算幂等键）
渠道方 EOA
渠道方在 BAC 链上自管的资金钱包
用户托管 EOA / 用户钱包
Yesono 为每用户派生的 BAC EOA，私钥由 signer 保管
Operator 钱包
项目方业务签名钱包（如 CheckMarket）
Admin 钱包
项目方运营钱包（如创建市场）
Gas-tank
给所有用户钱包补 BAC 原生币 gas 的 EOA
user-pool / operator-pool / admin-pool
signer 内按用途分类的钱包池
BAC 链
Yesono 自部署 EVM 链（chainId 66666）
dYdX 链
Yesono 自部署 dYdX v4 fork 链（撮合）
跨链桥
BAC ↔ dYdX 资产跨链协议（合约 + RPC）
懒归集
静默窗口达到后才触发跨链归集，避免反复搬资金
AllbetMarketV1
BAC 链上亚盘足球市场合约
UmaCtfAdapter
BAC 链上其他预测市场创建合约（基于 Uma + CTF）
CTF
Conditional Token Framework
EOA 方案
渠道方自管 EOA、不用多签合约的资金对接方案
多租户
signer 同时服务 tob / 量化 / 机器人等多个业务方


---

9. 待确认事项汇总

参考主计划 [evm-b-yesono-...md](../../../21437/.claude/plans/evm-b-yesono-b-yesono-yesono-usdt-b-api-lively-rabbit.md) §"待与 B 端渠道方确认的问题清单" 与 §"关键决策待跟进"。要点：

ID
主题
影响
Q1
是否每单都调 cancelBet/winLoss？是否支持批量？
影响 LazyCollector 的归集粒度
Q2
懒归集窗口能否被渠道方接受？playerBalance 在窗口内返回什么？
影响 Q1 + 用户余额展示
Q3
嵌入页余额展示来源
前端 + tob /balance 接口设计
Q4
渠道 EOA 安全要求（冷热分离/限额/监控）
合作协议条款
| ~~Q5~~ | ~~渠道 EIP-712 签名结构体字段定义~~ | ~~已废弃~~：EOA 方案下渠道方 `/bet` 不再要求返回 EIP-712 签名，receipt 即可作为非否认凭证 |
| Q6 | dYdX 跨链 RPC 能否直接指定接收地址 | 决定归集是否需要中转 |
| Q7 | 多渠道接入 | HD 派生路径 channel 维度（已设计）|
| Q8 | AllbetMarketV1 / UmaCtfAdapter 接入边界（哪些是用户操作 / 哪些是平台操作）+ 何时下线前端 NEXT_PUBLIC_PRIVATE_KEY | signer 接口分发 + operator 私钥迁移计划 |
| D1 | gas 模型 | 建议方案 B（gas-tank top-up）|
| D2 | 链上确认数 | 建议 6（按 BAC 实际可调）|
| D3 | dYdX → BAC 跨链 RPC 接口签名 | 与 dYdX 团队对齐 |
| D4 | signer 平台命名 | yesono-vault 等 |
| D5 | signer 部署形态 | 建议起步单实例多租户 |


---

10. 后续步骤

1. 各项目 PRD 评审（本文档 + 4 份子 PRD）
2. 与渠道方对接 Q1-Q8
3. 与 dYdX 团队对接 D3 + 跨链桥契约
4. 内部确认 D1-D5
5. 各项目按 PRD 与排期开发，按 §3 流程联调