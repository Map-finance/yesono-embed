阅读文档 tob-controller-api.md， 这个接口文档里面的接口 都是项目内原有功能的替换，仔细核对文档中接口的字段与原有功能接口的字段， 如果有区别 则需要你列出一个文档，如果你有模糊不清的需求理解 也需要列出文档总结出来

# To-B 相关 HTTP 接口说明

本文档对应以下控制器中的接口实现：

- `TobOrderController` — 创建订单  
- `TobOrderActionController` — 拆单 / 合并 / 赎回 / 动作状态  
- `TobOrderCancelController` — 取消订单  
- `TobQueryController` — 余额、订单、链上动作、划转查询  
- `TobUmaMarketController` — UMA 聚合市场创建  

**基础约定**

- **Content-Type**：`POST` 且带 body 的接口使用 `application/json`。  
- **统一响应体**：`com.pd.market.utility.base.R<T>`  

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | int | 业务/HTTP 风格状态码，成功一般为 `200` |
| `success` | boolean | `code == 200` 时为 `true` |
| `data` | T | 业务数据，失败时多为 `null` |
| `msg` | string | 提示信息，成功时常见为 `"OK"` 或默认成功文案 |

- **鉴权**：上述接口均标注 `@RequireLogin`，需在请求头携带有效 **`Authorization`**（JWT access token；解析与缓存校验逻辑见 `AuthInterceptor`）。若上下文中无法解析出用户 ID，部分接口会返回未授权类错误（如 `User not authenticated`）。  
- **GET 查询参数**：未使用 `@RequestParam` 显式命名时，Spring 默认按 JavaBean 属性名绑定（如 `userId`、`channelCode`、`limit`、`offset`）。列表参数 `statuses` 通常使用重复键：`statuses=OPEN&statuses=FILLED`（以实际网关/Spring 配置为准）。

---

## 1. 创建订单 — `TobOrderController`

**Base path**：`/api/orders`

### 1.1 创建 To-B 订单

| 项目 | 说明 |
|------|------|
| Method | `POST` |
| Path | `/api/orders/tob/order/create` |
| 说明 | To-B 下单编排入口；注释说明核心订单表由 `yesono-router` 写入。幂等键为 `clientId`（落库为 `bet_id`），重复请求应返回同一快照响应。 |

**Request body**：`TobOrderCreateReq`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `clientId` | string | 是 | 幂等键，对应渠道侧 clientId |
| `beltId` | string | 是 | 业务字段（与路由侧约定一致） |
| `eventId` | long | 是 | 事件 ID |
| `tokenId` | string | 是 | Token ID |
| `side` | string | 是 | 买卖方向等 |
| `amount` | decimal | 是 | 渠道扣款金额（与 router `amount` 一致） |
| `size` | decimal | 是 | 数量 |
| `orderType` | string | 是 | 订单类型 |
| `orderPrice` | decimal | 否 | LIMIT 等场景价格 |
| `expiryTime` | string | 是 | 过期时间 |
| `orderFlags` | int | 是 | 订单标志位 |
| `clobPairId` | string | 是 | CLOB 交易对 ID（字符串数字，如 `"2400820"`） |

**Response `data`**：`TobOrderCreateResp`

| 字段 | 类型 | 说明 |
|------|------|------|
| `betId` | string | 幂等/订单侧标识 |
| `status` | string | 状态 |
| `channelTxHash` | string | 渠道链上交易哈希 |
| `routerOrderId` | long | 路由订单 ID |
| `bridgeBacTxHash` | string | Bridge 相关哈希 |
| `bridgeDydxConfirmRef` | string | Bridge/dYdX 确认引用 |
| `routerOrderStatus` | string | 路由订单状态 |
| `message` | string | 附加说明 |

---

## 2. 订单动作 — `TobOrderActionController`

**Base path**：`/api/tob/order`

### 2.1 拆单（Split）

| 项目 | 说明 |
|------|------|
| Method | `POST` |
| Path | `/api/tob/order/split` |

**Request body**：`TobOrderSplitReq`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `betId` | string | 是 | 订单/下注标识 |
| `marketId` | string | 是 | 市场 ID |
| `amount` | string | 是 | 数量（字符串形式） |

**Response `data`**：`TobOrderActionResp`

| 字段 | 类型 | 说明 |
|------|------|------|
| `betId` | string | |
| `actionType` | string | 动作类型 |
| `routerOrderId` | long | 路由订单 ID |
| `actionId` | string | 动作 ID |
| `status` | string | 状态 |
| `message` | string | 说明 |

### 2.2 合并（Merge）

| 项目 | 说明 |
|------|------|
| Method | `POST` |
| Path | `/api/tob/order/merge` |

**Request body**：`TobOrderMergeReq`（字段同拆单：`betId`、`marketId`、`amount`，均必填）

**Response `data`**：`TobOrderActionResp`（结构同 2.1）

### 2.3 赎回（Redeem）

| 项目 | 说明 |
|------|------|
| Method | `POST` |
| Path | `/api/tob/order/redeem` |

**Request body**：`TobOrderRedeemReq`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `betId` | string | 是 | |
| `marketId` | string | 是 | |

**Response `data`**：`TobOrderActionResp`（结构同 2.1）

### 2.4 查询动作状态

| 项目 | 说明 |
|------|------|
| Method | `GET` |
| Path | `/api/tob/order/{betId}/action/status` |

**Path 参数**

| 参数 | 说明 |
|------|------|
| `betId` | 订单/下注标识 |

**Response `data`**：`TobOrderActionStatusResp`

| 字段 | 类型 | 说明 |
|------|------|------|
| `betId` | string | |
| `actionType` | string | |
| `routerOrderId` | long | |
| `actionId` | string | |
| `status` | string | 本地/编排状态 |
| `routerStatus` | string | 路由侧状态 |
| `message` | string | |

---

## 3. 取消订单 — `TobOrderCancelController`

**Base path**：`/api/tob/order`

### 3.1 取消 To-B 订单

| 项目 | 说明 |
|------|------|
| Method | `POST` |
| Path | `/api/tob/order/{betId}/cancel` |

**Path 参数**

| 参数 | 说明 |
|------|------|
| `betId` | 要取消的订单标识 |

**Response `data`**：`TobOrderCancelResp`

| 字段 | 类型 | 说明 |
|------|------|------|
| `betId` | string | |
| `routerOrderId` | long | |
| `status` | string | |
| `message` | string | |

---

## 4. 综合查询 — `TobQueryController`

**Base path**：`/api/tob/query`  

以下均为 **GET**，查询条件通过 **Query String** 传递。

### 4.1 按用户查单笔余额汇总

| 项目 | 说明 |
|------|------|
| Path | `/api/tob/query/balances/user` |

**Query**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `userId` | long | 是 | 用户 ID |

**Response `data`**：`TobUserBalanceItemResp`

| 字段 | 类型 | 说明 |
|------|------|------|
| `userId` | long | |
| `channelCode` | string | 渠道编码 |
| `cash` | decimal | 现金余额 |
| `portfolio` | decimal | 持仓/组合相关金额 |

### 4.2 按渠道分页查用户余额列表

| 项目 | 说明 |
|------|------|
| Path | `/api/tob/query/balances/channel` |

**Query**：`TobUserBalancePageReq`

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `channelCode` | string | 是 | — | |
| `limit` | int | 否 | `25` | 每页条数 |
| `offset` | int | 否 | `0` | 偏移 |

**Response `data`**：`TobUserBalancePageResp`

| 字段 | 类型 | 说明 |
|------|------|------|
| `limit` | int | |
| `offset` | int | |
| `total` | long | 总条数 |
| `list` | `TobUserBalanceItemResp[]` | 当前页数据 |

### 4.3 按订单 ID 查询订单列表

| 项目 | 说明 |
|------|------|
| Path | `/api/tob/query/orders/order-id` |

**Query**：`TobOrderQueryReq` 中使用的字段

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `orderId` | long | 是 | |
| `statuses` | string[] | 否 | 状态过滤，多值见上文 GET 列表示意 |

**Response `data`**：`TobOrderItemResp[]`（列表，非分页包装）

`TobOrderItemResp` 字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `orderId` | long | |
| `userId` | string | |
| `status` | string | |
| `tokenId` | string | |
| `side` | string | |
| `filledSize` | decimal | 成交数量 |
| `avgFillPrice` | decimal | 成交均价 |
| `createdAt` | long | 创建时间戳 |

### 4.4 按用户分页查订单

| 项目 | 说明 |
|------|------|
| Path | `/api/tob/query/orders/user` |

**Query**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `userId` | long | 是 | — | |
| `limit` | int | 否 | `25` | |
| `offset` | int | 否 | `0` | |
| `statuses` | string[] | 否 | | |

**Response `data`**：`TobOrderPageResp`

| 字段 | 类型 | 说明 |
|------|------|------|
| `limit` | int | |
| `offset` | int | |
| `total` | long | |
| `list` | `TobOrderItemResp[]` | |

### 4.5 按渠道分页查订单

| 项目 | 说明 |
|------|------|
| Path | `/api/tob/query/orders/channel` |

**Query**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `channelCode` | string | 是 | — | |
| `limit` | int | 否 | `25` | |
| `offset` | int | 否 | `0` | |
| `statuses` | string[] | 否 | | |

**Response `data`**：`TobOrderPageResp`

### 4.6 按用户分页查链上动作

| 项目 | 说明 |
|------|------|
| Path | `/api/tob/query/actions/user` |

**Query**：`TobChainActionQueryReq`

| 参数 | 类型 | 必填 | 默认值 |
|------|------|------|--------|
| `userId` | long | 是 | — |
| `limit` | int | 否 | `25` |
| `offset` | int | 否 | `0` |

**Response `data`**：`TobChainActionPageResp`

| 字段 | 类型 | 说明 |
|------|------|------|
| `limit` | int | |
| `offset` | int | |
| `total` | long | |
| `list` | `TobChainActionItemResp[]` | |

`TobChainActionItemResp`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `userId` | long | |
| `type` | string | 动作类型 |
| `amount` | decimal | |
| `timestamp` | long | |
| `marketId` | long | |
| `txHash` | string | 交易哈希 |

### 4.7 按渠道分页查链上动作

| 项目 | 说明 |
|------|------|
| Path | `/api/tob/query/actions/channel` |

**Query**

| 参数 | 类型 | 必填 | 默认值 |
|------|------|------|--------|
| `channelCode` | string | 是 | — |
| `limit` | int | 否 | `25` |
| `offset` | int | 否 | `0` |

**Response `data`**：`TobChainActionPageResp`

### 4.8 按用户分页查划转记录

| 项目 | 说明 |
|------|------|
| Path | `/api/tob/query/transfers/user` |

**Query**：`TobTransferQueryReq`

| 参数 | 类型 | 必填 | 默认值 |
|------|------|------|--------|
| `userId` | long | 是 | — |
| `limit` | int | 否 | `25` |
| `offset` | int | 否 | `0` |

**Response `data`**：`TobTransferPageResp`

| 字段 | 类型 | 说明 |
|------|------|------|
| `limit` | int | |
| `offset` | int | |
| `total` | long | |
| `list` | `TobTransferItemResp[]` | |

`TobTransferItemResp`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `userId` | long | |
| `type` | string | |
| `amount` | decimal | |
| `timestamp` | long | |
| `txHash` | string | |
| `userAddress` | string | 用户地址 |
| `toAddress` | string | 目标地址 |

### 4.9 按渠道分页查划转记录

| 项目 | 说明 |
|------|------|
| Path | `/api/tob/query/transfers/channel` |

**Query**

| 参数 | 类型 | 必填 | 默认值 |
|------|------|------|--------|
| `channelCode` | string | 是 | — |
| `limit` | int | 否 | `25` |
| `offset` | int | 否 | `0` |

**Response `data`**：`TobTransferPageResp`

---

## 5. UMA 聚合市场 — `TobUmaMarketController`

**Base path**：`/api/tob/market/uma`

### 5.1 创建 UMA 聚合市场

| 项目 | 说明 |
|------|------|
| Method | `POST` |
| Path | `/api/tob/market/uma/create` |

**Request body**：`TobUmaMarketCreateReq`。

#### 全体调用均需提供的字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `betId` | string | 是 | 幂等键；同一 `betId` 重复请求会直接返回已落库的订单快照 |
| `type` | string | 是 | 取值：`common` / `sports` / `crypto`（大小写不敏感；服务会把 `sport` 视作 `sports`，把 `cryoto` 视作 `crypto`） |
| `betAmount` | decimal | 是（业务流程） | 渠道下注金额；服务要求 **大于 0**，否则会报错「betAmount 必须大于 0」 |

以下为 **`type` 分支**：每种类型只需关心本节列出的字段；其余与本分支无关的字段可不传。

---

#### `type = common`（通用 / 事件批量市场）

**编排入口**：映射为 `MarketNewReq`，走 `createMarketBatch`。

**本分支必填（`TobUmaMarketCreateService.validateReq`）**

| 字段 | 类型 | 说明 |
|------|------|------|
| `liveness` | int | **必填**，且必须 **> 0**，用于 UMA 链上批量初始化（`umaBatchInitialize`） |
| `eventId` 或 `eventTitle` | long / string | **至少填一个**：沿用已有事件用 `eventId`；新建或匹配事件用 `eventTitle` |
| `outcomes` | array | **必填且非空**；元素类型见下表「OutcomeOption」 |

**本分支可选（写入通用创建请求）**

| 字段 | 类型 | 说明 |
|------|------|------|
| `tags` | long[] | 标签 ID 列表 |
| `marketType` | string | 玩法类型（如 `YES_NO`），服务端会做规范化 |
| `slug` | string | 事件 URL 别名 |
| `commonResolutionDate` | long | 停止下注时间，毫秒时间戳 |
| `image` | string | 图片 |
| `description` | string | 描述 |

**`outcomes[]` 元素 — `MarketNewReq.OutcomeOption`**

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 候选人 / 结果名称 |
| `question` | string | 生成的市场标题（问题） |
| `slug` | string | 市场 slug |
| `image` | string | 图片 |
| `description` | string | 描述 |

---

#### `type = sports`（体育赛事批量玩法）

**编排入口**：映射为 `MarketNewGameReq`，走 `createGamesMarketBatch`。

**本分支必填**

| 字段 | 类型 | 说明 |
|------|------|------|
| `gameId` | long | 比赛 ID（对应库表 `Candidate.id`）；比赛须为 **已调度（SCHEDULED）** 状态 |
| `markets` | array | **非空**；每个元素为一场玩法配置，见下表 |

**`markets[]` 元素 — `MarketNewGameReq.MarketGameOutcomeRequest`**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `marketType` | string | 是 | 玩法编码，例如：`moneyline` / `totals` / `spreads` / `binary`（与 `MarketType` 枚举一致） |
| `outcomes` | string[] | 是 | 非空；每条 outcome 字符串不能为空 |

玩法含义（与 Swagger 注释及展开逻辑一致，摘录便于对接）：

- **moneyline**：传参与者 ID 字符串；须能覆盖主客队两条线；`DRAW` / `TIE` 可选，仅在传入时创建平局市场。
- **totals / spreads**：传盘口线字符串，须可解析且能被 **0.25** 整除。
- **其它玩法**：每个 outcome 值对应创建一个 yes/no 市场。

---

#### `type = crypto`（加密资产定向市场批量）

**编排入口**：请求体会被组装为 `CryptoMarketCreateReq`（含事件侧可选字段 + `cryptoMarkets` → `markets`），走 `createCryptoMarketBatch`。

**本分支必填（TOB 校验 + 批量创建校验）**

| 字段 | 类型 | 说明 |
|------|------|------|
| `eventType` | string | 事件类型；会先 **trim + 大写**，再将 `-` 转为 `_`。允许取值：`ABOVE`、`BELOW`、`PRICE_RANGE`、`HIT_PRICE`、`FIRST_TO_HIT`（也可传如 `PRICE-RANGE` 等形式，规范化后与上一致） |
| `cryptoMarkets` | array | **非空**；映射为内部的 `markets` |
| `coinSymbol` | string | 币种符号；须在 `crypto_coins` 中存在（校验时会 **转大写**） |
| `coinId` | long | 币种关联 ID（与 `CryptoMarketCreateReq` / `EventCryptoProfile` 约定一致） |
| `eventId` 或 `eventTitle` | long / string | **二选一**：指定已有事件 ID；或提供标题用于新建 / 按 slug 匹配已有事件（无 `eventId` 时 **`eventTitle` 必填**） |

**`cryptoMarkets[]` 元素 — `CryptoMarketCreateReq.CryptoMarketItem`**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `question` | string | 是 | 市场问题 |
| `slug` | string | 否 | 不传则服务端按 `question` 生成 |
| `image` | string | 否 | 市场图 |
| `description` | string | 否 | 市场描述 |
| `marketValue` | decimal | 否 | 主目标值（兼容字段） |
| `targetRule` | string | 否 | 通用规则，例如 `RANGE:100000,120000`、`GT:120000`、`LT:95000`、`FIRST_HIT:10000,20000` |
| `outcomes` | string[] | 否 | 选项列表；默认 YES/NO；`FIRST_TO_HIT` 等玩法推荐传数值 |

**事件级可选（会传入 `CryptoMarketCreateReq`，新建事件时使用）**

| 字段 | 类型 | 说明 |
|------|------|------|
| `description` | string | 事件描述 |
| `image` | string | 事件图片 |
| `commonResolutionDate` | long | 停止下注时间（毫秒） |
| `tagsSlug` | string[] | 写入 `events.tags_slug` 的标签 |

---

**Response `data`**：`TobUmaMarketCreateResp`

| 字段 | 类型 | 说明 |
|------|------|------|
| `betId` | string | |
| `status` | string | |
| `eventId` | long | |
| `channelTxHash` | string | |
| `marketIds` | long[] | 创建出的市场 ID 列表 |
| `questionIds` | string[] | 问题 ID 列表 |
| `message` | string | |

---

## 6. 错误与参数校验说明

- **控制器层显式校验**  
  - 未登录：`User not authenticated`（配合 `ResultCode.UN_AUTHORIZED`）。  
  - 查询接口缺少必填 query：`ResultCode.PARAM_MISS` 及英文说明（如 `userId is required`、`channelCode is required`、`orderId is required`）。  
- **Bean Validation**：带 `@Valid` 的 JSON 请求在校验失败时由全局异常处理返回（具体结构以项目统一异常处理器为准）。  
- **`TobQueryController`** 中查询接口依赖调用方传入 `userId` / `channelCode` 等，**未**在控制器内与 `UserContext` 做强制一致性校验；若需「只能查本人」，应在网关或服务层补充策略。

---

*文档生成依据：`prediction-market-service-api` 模块上述控制器及对应 `request`/`response` 类型（与代码保持同步时请对照源码）。*
