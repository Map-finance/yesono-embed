# `tob-controller-api.md` 与项目现有接口的对比 + 待澄清清单

> 文档版本：v1.1（已落实后端答复）
>
> ## 后端答复（v1.1，已落地）
>
> | 问题 | 答复 | 落地动作 |
> | --- | --- | --- |
> | **Q1-Q4 / Q9 / Q13** 查询类接口 | 文档中所有查询接口（balances / orders / actions / transfers）**全部不接入**，沿用旧 `lib/api.ts` | 删除 `tobBalance.ts / tobChainActions.ts / tobTransfers.ts / tobOrders 中的 query 函数` 及对应 hooks |
> | **Q1 / Q6** `betId` 来源 | `betId` = 幂等键，前端生成唯一值（建议 uuid）；同 `clientId` 一致，防止重复请求 | `TobOrderCreateReq` 字段 `clientId` 重命名为 `betId` |
> | **Q5** 余额 | 余额逻辑回滚到 **FR-4 方案之前**的状态，沿用旧逻辑 | 删除 `lib/hooks/useTobBalance.ts` / `EmbedBalanceBadge` / `Header` 挂载 / `lib/services/tobApi.ts` |
> | **Q7** `beltId` | 笔误，去掉；同时 `clientId` 改名 `betId` | `TobOrderCreateReq` 已调整 |
> | **Q8** auth / wallet | 沿用之前的（项目原本就没有显式 verify），不需要前端 `/auth/verify` 调用 | 删除 `verifyAuth` 调用 + `wallet` 字段 + `verifying` 状态 |
> | **Q10** `expiryTime / orderFlags / clobPairId` | 沿用旧下单逻辑的字段格式 | 类型保留，注释指向"沿用旧逻辑" |
> | **Q11 / Q12** UMA 市场 | 仅创建接口路径变更（合三为一）；**参数与逻辑不变**；**去掉前端合约调用**（改由后端在新接口内代为上链） | UMA hook 保留；P5 阶段调用方移除链上交互 |
> | **Q14** base path 不一致 | 按文档照搬 | 已保持原 path |
>
> ### 范围调整
>
> - **保留并继续推进**：创建订单（§1）/ 拆-合-赎（§2）/ 取消订单（§3）/ UMA 市场创建（§5）
> - **完全废弃**：综合查询（§4 全节）
> - **回滚**：FR-4 余额展示（三档徽章）+ FR-2 SSO `/auth/verify` 调用 + `wallet` 上下文字段
>
> 实施计划见 [tob-controller-api-impl-plan.md](./tob-controller-api-impl-plan.md)（v1.1 已精简）。
>
> ---
>
> ## 原始 v1 对比内容（保留作历史参考）

> 文档版本：v1（草稿）
> 输入：[`docs/tob-controller-api.md`](./tob-controller-api.md)（后端 To-B 控制器接口规范）
> 比对对象：本仓库 `yesono-embed`（已实现 FR-1 通信层、FR-2 SSO、FR-4 余额）+ `lib/api.ts` / `lib/services/marketService.ts` / `lib/hooks/pna/*` 中的现有 C 端 / PNA 接口。
>
> 目的：在动手把现有功能切换到新 To-B 接口前，先把"字段差异"和"语义模糊点"全部摊到桌面上，避免下游业务（持仓、活动、下单、取消、Claim、市场创建）切到新口径后出现"字段对不上"或"功能减项"的隐性回归。

---

## 0. 总体观察（先看结论）

1. **整体方向是把"全站统一接口"重做成 To-B 多租户接口**：所有 To-B 接口都带 `betId`（订单幂等键）/ `routerOrderId`（路由侧 ID），明确区分 To-B vs C 端订单空间。
2. **新接口字段普遍精简**：现有 C 端接口（`UnfinishedAggregatedOrder`、`Position`、`Activity`）字段非常细，新接口仅保留交易/状态核心字段。**这意味着前端切到新接口后会丢失若干 UI 已经在用的展示字段**（gas、过期、进度、当前价、P&L 等），需要逐项确认是后端补字段、还是前端降级展示。
3. **新接口把 C 端的"活动一张大表"拆成三张表**：`/orders/*`（撮合订单）、`/actions/*`（链上动作 split/merge/redeem）、`/transfers/*`（划转 deposit/withdraw）。前端 `app/pna/components/activity-table.tsx` 当前用 `TYPE_META` 把 7 种 type 混在一张表里渲染，**需要做合并器（client-side merge）或改 UI 拆 3 个 Tab**。
4. **新接口里没有 `/auth/verify`、`/balance` 三档明细、`/wallet/address`**：这与我前一阶段按 [FR-2 / FR-4](./embed-fr2-fr4-impl.md) 实现的 `lib/services/tobApi.ts` 假设不一致。需要后端确认这些是另开 controller、还是不再单独暴露（依赖 JWT + `/balances/user`）。
5. **新接口没有"Position（持仓聚合视图）"**：只有"Order（撮合订单）"和"链上动作"。`canClaim` 怎么算？`currentPrice` / P&L 由谁算？这是显著缺口。

---

## 1. 接口对比表

### 1.1 取消订单

| 维度       | 现有：`@/Users/kksthinkpad/res/code/js/yesono-embed/lib/api.ts:228-244`                                              | 新：`POST /api/tob/order/{betId}/cancel`                                  | 差异 |
| ---------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---- |
| 路径       | `${ROUTER_BASE_URL}/order/cancel`                                                                                | `/api/tob/order/{betId}/cancel`                                           | base 变更（router → tob 网关）；body → path |
| Method     | POST + body `{ orderId: string }`                                                                                | POST + path param `betId`                                                  | 取消标识 **`orderId` → `betId`**（语义变化）|
| Resp       | `{ code, message, data: boolean }`                                                                               | `TobOrderCancelResp { betId, routerOrderId, status, message }`             | 富响应：含 `routerOrderId` 和 `status`；前端原本只看 `data===true`，要重写成读 `status` |

**Action**：替换 `cancelOrderApi` 实现；调用方需把"传入 orderId"改成"传入 betId"。
**注意**：现在传给 `cancelOrderApi` 的实参是 `UnfinishedAggregatedOrder.orderId`（数字），而新接口要求 `betId`（字符串/幂等键）—— 这两个**不是同一个 ID**。详见 [§5 待澄清 Q1](#5-待澄清问题清单)。

---

### 1.2 订单查询（按用户 / 按订单 ID / 按渠道）

| 维度       | 现有：`@/Users/kksthinkpad/res/code/js/yesono-embed/lib/api.ts:149-162` `getUnfinishedOrders`               | 新：`GET /api/tob/query/orders/user`                            | 差异 |
| ---------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---- |
| 路径       | `${AUTH_BASE_URL}/orders/unfinished?userId=`                                                                | `/api/tob/query/orders/user?userId=&limit=&offset=&statuses=`   | path 变更；新增分页 |
| Resp item  | `UnfinishedAggregatedOrder`                                                                                 | `TobOrderItemResp`                                              | **字段大量缩减** |

**字段差异（同一条订单）**

| 现有 `UnfinishedAggregatedOrder`             | 新 `TobOrderItemResp` | 备注 |
| -------------------------------------------- | --------------------- | ---- |
| `orderId: number`                             | `orderId: long`        | 等价 |
| `userId: string`                              | `userId: string`       | 等价 |
| `tokenId: string`                             | `tokenId: string`      | 等价 |
| `side: 'BUY' \| 'SELL'`                       | `side: string`         | 类型放宽 |
| `status: 'CREATED' \| 'WAITING_DEPOSIT' \| 'PARTIALLY_DEPOSITED' \| 'EXECUTING'` | `status: string` | 状态枚举改了，**新枚举值未列出** ⚠ |
| `filledSize: number`                          | `filledSize: decimal`  | 等价 |
| `avgFillPrice: number`                        | `avgFillPrice: decimal`| 等价 |
| `orderType: string`                           | —                       | **丢失** |
| `orderPrice: number`                          | —                       | **丢失**（LIMIT 单的限价） |
| `estimatedGasFee` / `actualGasFee` / `tradingFee` | —                  | **丢失**（费率展示） |
| `placedAmount` / `placedSize`                 | —                       | **丢失**（已下单进度） |
| `outComeUnionKey: string`                     | —                       | **丢失**（前端按它跳详情） |
| `expiresAt` / `executedAt` / `completedAt`    | —                       | **丢失**（生命周期时间戳） |
| `eventId: string`                             | —                       | **丢失**（事件聚合） |
| —                                             | `createdAt: long`       | 新增 |

**Action**：建议后端在 `TobOrderItemResp` 上补回 `orderType / orderPrice / outComeUnionKey / eventId / completedAt`，否则前端"未完成订单卡片"无法保留现有展示。

---

### 1.3 持仓 / Claim 视图

| 维度 | 现有：`@/Users/kksthinkpad/res/code/js/yesono-embed/lib/api.ts:170-212` `getPositions` / `getClosedPositions` | 新接口 | 差异 |
| ---- | ---------------------------------------------------------------------------------------------------------- | ------ | ---- |
| 路径  | `${AUTH_BASE_URL}/positions/new` 和 `/positions/closed-new`                                                 | **未提供** | ⚠ 持仓视图无对应 To-B 接口 |
| Resp | `Position` 包含 `shares / avgPrice / currentPrice / value / profit / profitPct / canClaim / conditionId / yesTokenId / noTokenId / unionKey ...` | — | 新 `TobOrderItemResp` 是逐笔订单视图，无聚合 |

**Action**：详见 [§5 Q2](#5-待澄清问题清单)。

---

### 1.4 活动记录（已成交 + 链上动作 + 划转，原本一张表）

现有 `getActivityList`（`@/Users/kksthinkpad/res/code/js/yesono-embed/lib/hooks/pna/use-get-activity.ts:11-25`）：

```ts
interface Activity {
  type: 'Buy' | 'Sell' | 'MERGE' | 'REDEEM' | 'DEPOSIT' | 'WITHDRAW';
  market: string;
  outcomeName: string | null;
  price: number;
  shares: number;
  amount: number;
  timestamp: number;
  marketId: number | null;
  txHash: string;
  icon?: string;
  eventSlug?: string;
  question?: string;
}
```

新接口把这一张表**拆成两个**（订单类已经在 1.2，剩下两个）：

| 类型               | 新接口                                               | Resp item                                                                                                |
| ------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 链上动作（含 SPLIT/MERGE/REDEEM） | `GET /api/tob/query/actions/user`                  | `TobChainActionItemResp { userId: long, type, amount, timestamp, marketId: long, txHash }`              |
| 划转（DEPOSIT/WITHDRAW）           | `GET /api/tob/query/transfers/user`                | `TobTransferItemResp { userId: long, type, amount, timestamp, txHash, userAddress, toAddress }`         |

**字段差异**（统一比较）

| 现有 `Activity` 字段       | 新 `Action` / `Transfer` | 备注 |
| -------------------------- | ------------------------ | ---- |
| `type` (混合 Buy/Sell + 链上) | 拆到两个接口              | **架构变化** |
| `market: string`            | —                         | **丢失**（市场名/标题） |
| `outcomeName`               | —                         | **丢失** |
| `price`                     | —                         | **丢失**（成交价） |
| `shares`                    | —                         | **丢失** |
| `amount`                    | `amount: decimal`         | 保留 |
| `timestamp`                 | `timestamp: long`         | **类型差异**：`number` → `long`（原是秒还是毫秒？新口径未明） |
| `marketId: number \| null`  | `marketId: long`（仅 actions） | transfer 里没有 marketId |
| `txHash`                    | `txHash`                   | 保留 |
| `icon` / `eventSlug` / `question` | —                  | **丢失**（前端表格列要的） |
| —                           | `userAddress` / `toAddress`（仅 transfers） | 新增 |

**Action**：详见 [§5 Q3](#5-待澄清问题清单)。

也存在重叠功能 `getChainTransactions`（`@/Users/kksthinkpad/res/code/js/yesono-embed/lib/api.ts:304-320`） → `${AUTH_BASE_URL}/activity/chain-transactions`，与新 `actions/user` + `transfers/user` 在概念上有交集。要不要保留 `chain-transactions` 也需要明确（[§5 Q4](#5-待澄清问题清单)）。

---

### 1.5 余额查询

| 维度  | 我前期按 FR-4 实现：`@/Users/kksthinkpad/res/code/js/yesono-embed/lib/services/tobApi.ts:147-150`              | 新：`GET /api/tob/query/balances/user`                              | 差异 |
| ----- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---- |
| 路径   | `GET /api/tob/balance`                                                                                    | `GET /api/tob/query/balances/user?userId=`                         | path 不同 |
| Resp  | `{ channel, bac, tradeChain, recommended, currency, serverTime }`（FR-4 规范的三档 + 主显金额）             | `TobUserBalanceItemResp { userId, channelCode, cash, portfolio }`  | **形态完全不同** |

**字段语义不一致**（关键）：
- FR-4 规范：渠道账本 + BAC USDT + 交易链 freeCollateral 三档
- 新 controller：只有 `cash` + `portfolio` 两个字段
  - `cash` 是哪一档？渠道现金？还是 BAC + 交易链汇总？
  - `portfolio` 是持仓**估值**还是**保证金占用**？
  - 三档明细如何展示（FR-4.2 方案 B）？

**Action**：必须澄清。详见 [§5 Q5](#5-待澄清问题清单)。

---

### 1.6 拆单 / 合并 / 赎回（CTF）

| 维度 | 现有 | 新 | 差异 |
| ---- | ---- | -- | ---- |
| 路径 | **前端目前无相应 API 调用**（仅 UI 占位，详见 `app/pna/components/positions-table.tsx:66-71` 的 `canClaim` 标签） | `POST /api/tob/order/{split,merge,redeem}` | **新增能力** |
| 请求 | — | `{ betId, marketId, amount? }` | `redeem` 不需 `amount` |

**Action**：纯新增，无替换；按 [§4 实现计划 P1-CTF](./tob-controller-api-impl-plan.md) 落地即可。但要明确 `betId` 的来源（[§5 Q6](#5-待澄清问题清单)）。

---

### 1.7 创建订单（下单）

| 维度 | 现有 | 新：`POST /api/orders/tob/order/create` | 差异 |
| ---- | ---- | ---------------------------------------- | ---- |
| 路径 | **本仓库无下单 HTTP 接口**：C 端走链上 SDK 直签直下；目前 `lib/api.ts` 内只有 `cancelOrderApi`，无 createOrder | `POST /api/orders/tob/order/create` (注意 base 是 `/api/orders` 不是 `/api/tob/order`) | 新增 |
| Req  | — | `TobOrderCreateReq { clientId, beltId, eventId, tokenId, side, amount, size, orderType, orderPrice?, expiryTime, orderFlags, clobPairId }` | — |
| Resp | — | `TobOrderCreateResp { betId, status, channelTxHash, routerOrderId, bridgeBacTxHash, bridgeDydxConfirmRef, routerOrderStatus, message }` | — |

**Action**：纯新增能力；本期 FR-7 落地下单流程时按这个接口接入。但有几个字段名疑似笔误：

- `beltId` —— 不是 `betId` 也不是 `beltId` 的常见拼写。是 `betId` 的笔误？还是另有"belt"业务（皮带 / 系列编号？）。**需要后端确认**（[§5 Q7](#5-待澄清问题清单)）。
- `clientId` 和 `betId` 的关系：文档说 "幂等键为 `clientId`（落库为 `bet_id`）"——所以 `clientId` 是入参，落库才叫 `bet_id`，输出的 `TobOrderCreateResp.betId` 就等于入参 `clientId`。**前端调用方应把生成的幂等键放在 `clientId`**，并用响应的 `betId` 去做后续 cancel / split 等。

---

### 1.8 UMA 市场创建（合并旧三套接口）

| 维度  | 现有                                                                                                                  | 新：`POST /api/tob/market/uma/create`                                       | 差异 |
| ----- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ---- |
| 路径  | 三个独立接口：`POST /api/market`（common，`createMarketV2`） + `POST /api/market/crypto`（`createCryptoMarket`） + `POST /review_api/review/v1/market/sports/`（`reviewSportsMarket`） | 单一入口 + `type` 分支：`common` / `sports` / `crypto`                       | **三合一** |
| 共有  | —                                                                                                                  | `betId`、`type`、`betAmount`                                                  | 新增 To-B 字段 |
| common 必填 | 现有 `CreateMarketReqV2` 字段集（参 `lib/services/marketService.ts:199`）                                          | `liveness > 0`、`eventId 或 eventTitle`、非空 `outcomes[]`                    | 字段名一致但**新增 `liveness`** |
| sports 必填 | `reviewSportsMarket` 走 review_api，先审核拿 `unique_key`，再调 `createMarketV2`                                       | `gameId`（要求 SCHEDULED 状态）+ 非空 `markets[]`，每条 `{ marketType, outcomes[] }` | **省了"先审核拿 unique_key"步骤**，前端流程要改 |
| crypto 必填 | `createCryptoMarket` 现有字段（参 `lib/services/marketService.ts:495`）                                              | `eventType`（5 种）、非空 `cryptoMarkets[]`、`coinSymbol`、`coinId`、`eventId 或 eventTitle` | `marketValue` 改成更通用的 `targetRule` 字符串 |

**Action**：详见 [§4 实现计划 P3-UMA](./tob-controller-api-impl-plan.md)。

---

### 1.9 SSO Auth / Wallet

| 维度 | 我前期实现（基于 [FR-2 / tob_frontend.md](./tob_frontend.md)） | 新 `tob-controller-api.md` | 差异 |
| ---- | --------------------------------------------------------- | -------------------------- | ---- |
| 路径 | `POST /api/tob/auth/verify` / `GET /api/tob/auth/refresh` / `GET /api/tob/wallet/address` | **未在本文档列出** | ⚠ 缺接口 |

**Action**：详见 [§5 Q8](#5-待澄清问题清单)——是另写在别的 controller，还是新方案不需要前端显式 verify？

---

## 2. 字段类型 / 命名陷阱速查

整理出**前端切换时最容易翻车**的几处：

| 陷阱                                                                                                  | 影响                                                                |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `userId` 类型 `string`（旧）→ `long`（新，控制器内部）。但新查询接口在 `TobOrderItemResp` 里又写成 `string` | 前端类型层要统一成 `string`（JS 不能安全表达 `long`，应让后端序列化为字符串） |
| `marketId` 在 `TobChainActionItemResp` 是 `long`，需走 `string` 处理避免精度丢失                          | 同上                                                              |
| `timestamp` 单位（秒 vs 毫秒）—— 新文档全部写 `long`，未明示                                              | UI 时间显示偏差 1000 倍                                            |
| `amount` 在不同接口有时 `decimal`（数字）有时 `string`（如 split 接口要求字符串）                          | JS `Number` 精度风险；前端要按字段决定是否字符串                   |
| `betId` vs `clientId` vs `routerOrderId` vs `orderId`：四个 ID 概念                                   | 调用方一旦传错，幂等失效                                          |
| `expiryTime` 写成 `string`（在 `TobOrderCreateReq`），格式未定义（ISO？毫秒？）                         | 后端解析失败                                                      |
| `orderFlags: int` 含义未定义                                                                           | 前端不知该传什么                                                   |
| `clobPairId: string` 字符串数字示例 `"2400820"` —— 跨链对应关系？                                       | 前端要从市场详情拿，但当前 `Market` 类型可能没这个字段             |

---

## 3. 现有功能 ↔ 新接口 一一映射（速查）

| 现有功能 / 文件                                                                          | 新 To-B 接口                                                            | 替换方式 |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------- |
| `cancelOrderApi`（`@/Users/kksthinkpad/res/code/js/yesono-embed/lib/api.ts:228`）       | `POST /api/tob/order/{betId}/cancel`                                    | 完全替换 |
| `getUnfinishedOrders`（`lib/api.ts:149`）                                                | `GET /api/tob/query/orders/user`                                        | 替换（字段缩减需补） |
| `getPositions` / `getClosedPositions`（`lib/api.ts:170/195`）                            | **无对应** → 用 `orders/user` 自行聚合 或 后端补                         | 待澄清 |
| `getActivityList`（被 `useGetActivity` 调）                                             | `orders/user` + `actions/user` + `transfers/user` 三接口前端合并          | 拆分 + 合并 |
| `getChainTransactions`（`lib/api.ts:304`）                                              | `actions/user` + `transfers/user`                                       | 替换 |
| `getMarketCreatedRecords`（`lib/api.ts:253`）                                           | **无对应** → 推测仍走旧 `events/user`                                   | 不替换 |
| `createMarketV2` / `createCryptoMarket` / `reviewSportsMarket`（`marketService.ts`）   | `POST /api/tob/market/uma/create`（type 分支三合一）                     | 替换（流程简化） |
| FR-2 `verifyAuth`（`tobApi.ts:137`）                                                   | **未列入新文档** → 可能不再需要前端 verify                              | 待澄清 |
| FR-4 `getBalance`（`tobApi.ts:147`）                                                   | `GET /api/tob/query/balances/user`（字段从三档变 cash+portfolio）       | 替换（语义变化大） |
| FR-4 `getWalletAddress`（`tobApi.ts:152`）                                              | **未列入新文档**                                                        | 待澄清 |

---

## 4. 风险评估（按优先级）

| 优先级 | 风险点                                            | 备注                                                                 |
| ------ | ------------------------------------------------ | -------------------------------------------------------------------- |
| 🔴 高 | 余额接口字段从三档退化为 `cash + portfolio`        | FR-4 已落地的 UI 直接失效，必须先确认                                |
| 🔴 高 | 取消订单参数 `orderId` → `betId` 语义变化         | 调用点在 `app/pna/components/OrderBookTab.tsx`、订单 Cancel 按钮，不切对会报"找不到订单" |
| 🔴 高 | 持仓接口缺失                                      | `app/pna/components/positions-table.tsx` 整张表无数据来源              |
| 🟡 中 | 订单字段缩减（`orderType / orderPrice / completedAt` 等） | UI 列降级，但非阻塞                                                  |
| 🟡 中 | activity 拆 3 接口需要 client-side 合并            | 增加合并器代码量                                                      |
| 🟡 中 | UMA 市场 sports 分支不再走 review_api 预审         | 现有 sports 创建流程要重写                                            |
| 🟢 低 | `beltId` 字段拼写疑似 `betId`                      | 后端确认即可                                                          |
| 🟢 低 | `auth/verify` 不在本文档                           | 可能在别的 controller，FR-2 实现可能不需要改                          |

---

## 5. 待澄清问题清单

> 后端/产品需逐条回复，回复后此清单将合并进 [tob-controller-api-impl-plan.md](./tob-controller-api-impl-plan.md)。

### Q1（取消订单 ID 语义）

文档 §3.1 取消订单要求 `betId` 作为 path 参数。
- 现有前端拿到的是 `UnfinishedAggregatedOrder.orderId`（数字），新接口的 `betId` 是字符串幂等键。
- 是否要求**前端自己生成并保存 `betId` ↔ `orderId` 映射**？
- 还是 `getUnfinishedOrders` 的新版返回里要带 `betId` 字段？
- **建议**：在 `TobOrderItemResp` 上**追加 `betId: string`**。否则前端拿到 `orderId` 不知道怎么调 cancel。

### Q2（持仓视图）

新接口没有 `Position`（聚合持仓 + `canClaim` + `currentPrice` + P&L）。
- 持仓页 `app/pna/components/positions-table.tsx` 是**前端基于 `orders/user` 自行聚合**？
- 还是另有 `/api/tob/query/positions/*`（文档未列出）？
- `canClaim` 由谁判断？前端通过链上 `payoutDenominator > 0` 判断，还是后端字段？
- **建议**：在 `TobQueryController` 增加 `GET /api/tob/query/positions/user`，返回与现有 `Position` 等价的视图。

### Q3（Activity 拆 3 接口的字段补全）

新 `TobChainActionItemResp` / `TobTransferItemResp` 里没有 `market name` / `outcomeName` / `eventSlug` / `question` / `icon`。
- 这些是前端**自查 markets 表**拿，还是接口要补？
- 时间戳 `timestamp` 单位是 **秒还是毫秒**？
- `actions/user` 的 `type` 枚举完整列表是什么？（`SPLIT`、`MERGE`、`REDEEM`，还有别的？）
- `transfers/user` 的 `type` 是 `DEPOSIT/WITHDRAW`？还是包含 BAC↔交易链跨链？

### Q4（chain-transactions 是否还保留）

现有 `${AUTH_BASE_URL}/activity/chain-transactions` 与新 `/api/tob/query/actions/user` + `/transfers/user` 在概念上重叠。
- C 端 `chain-transactions` 接口在 To-B 上还存在吗？要不要前端切到新两个接口？

### Q5（余额接口字段语义）

新 `TobUserBalanceItemResp { userId, channelCode, cash, portfolio }`：
- `cash` 是渠道账本现金，还是 BAC + 交易链汇总？
- `portfolio` 是持仓估值还是保证金占用？
- 与 [tob_frontend.md FR-4.2 方案 B](./tob_frontend.md) 的"渠道 / BAC / 交易链"三档展示**完全不兼容**——FR-4.2 是否作废？还是方案 B 走另一个接口？
- 如果作废，`tradeChain` / `bac` 字段要不要从前端 `EmbedWalletAddress` / `TobBalanceBreakdown` 类型里删？
- **建议**：明确"现有 FR-4 方案 A 用 `cash`；方案 B 改用 `cash + portfolio` 二档"，或后端补三档字段。

### Q6（CTF Split / Merge / Redeem 的 betId 来源）

文档 §2.1-2.3 要求 `betId` 字段。
- 这里 `betId` 是**用户的什么 ID**？是建仓时的下单 betId？还是新生成的 action 幂等键？
- 同一持仓多次 split，`betId` 怎么确保唯一？

### Q7（`beltId` 字段名）

`TobOrderCreateReq.beltId` 字段是不是 `betId` 笔误？还是 belt-system 业务字段？

### Q8（Auth verify / Wallet address 接口）

- 文档没有 `/api/tob/auth/verify` / `/auth/refresh` / `/wallet/address`。
- FR-2 / FR-4 实现里我假设这些存在。
- **是这三个接口在本文档之外的另一个 controller，还是新方案不需要前端显式 verify**（依赖 JWT + AuthInterceptor 自动校验，verify 由 `/balances/user` 第一次成功调用隐式完成）？
- 如不需要 verify，前端 `lib/embed/EmbedContext.tsx:212` 收到 `embed:auth` 后的 `verifyAuth()` 调用要去掉，wallet 地址改从 `/balances/user` 或单独补的 `/wallet/address` 拿。

### Q9（订单状态枚举）

`TobOrderItemResp.status` 文档只写 `string`。
- 完整枚举值列表？是否兼容旧的 `CREATED` / `WAITING_DEPOSIT` / `PARTIALLY_DEPOSITED` / `EXECUTING` / `FILLED` / `CANCELLED` / `EXPIRED`？

### Q10（创建订单 expiryTime / orderFlags / clobPairId）

- `expiryTime: string` 格式？ISO 8601？还是毫秒字符串？
- `orderFlags: int` 含义？是不是 dYdX 的 short-term/long-term/conditional 标志？
- `clobPairId: string` 怎么从 `Market` 详情拿？现有前端 `Market` 类型里没这个字段。

### Q11（UMA 市场创建：sports 分支不再 review）

新文档 §5 sports 直接传 `gameId + markets[]` 创建。
- 旧流程的"先 POST review_api/review/v1/market/sports → 拿 unique_key → POST /api/market"是否完全废弃？
- 体育比赛的 `Candidate.id` 怎么从前端拿？现有 `getNeedTimeTagTags` / `Market` 数据里**没有 gameId**。

### Q12（UMA 市场创建：crypto 分支 targetRule）

文档示例 `RANGE:100000,120000`、`GT:120000`、`FIRST_HIT:10000,20000`：
- 是字符串自由文本，还是有 grammar？
- 旧 `CreateCryptoMarketReq` 里的 `marketValue` 是不是直接对应 `GT/LT/RANGE` 的数值部分？UI 怎么映射？

### Q13（多渠道 vs 多用户的查询权限）

文档 §6 提到 "查询接口未在控制器内与 `UserContext` 做强制一致性校验"——
- 前端调 `/api/tob/query/orders/user?userId=xxx` 是不是可以查别人的单？
- 网关层是不是会拦？
- 前端要不要主动只用 JWT 解出来的 `userId`，禁止 UI 传任意值？

### Q14（base path 不一致）

- §1.1 创建订单：`/api/orders/tob/order/create`（base `/api/orders`）
- §2-§3 动作 / 取消：`/api/tob/order/...`
- §4 查询：`/api/tob/query/...`
- §5 UMA 市场：`/api/tob/market/uma/...`

为什么 §1 创建订单不在 `/api/tob/order` 下？是历史遗留还是有意分离？

---

## 6. 下一步

完成本对比后：
1. 把这份文档发给后端，逐条回复 Q1-Q14。
2. 答复落实后，补 [tob-controller-api-impl-plan.md](./tob-controller-api-impl-plan.md) 的开发顺序与风险处理。
3. 我会基于 Q5 / Q8 决定是否回滚 `lib/services/tobApi.ts` 中按 FR-4 假设的字段（`tradeChain` / `bac`）。
