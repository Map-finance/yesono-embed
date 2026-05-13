# `tob-controller-api` 接入实施计划

> 文档版本：v1.1（后端答复已落实；阶段大幅精简）
>
> ## v1.1 范围
>
> 后端答复（见 [diff.md 顶部](./tob-controller-api-diff.md)）：
> - **所有查询类接口全部不接入**，沿用旧 `lib/api.ts`
> - **FR-4 余额 UI 回滚**，沿用旧逻辑
> - **FR-2 `/auth/verify` 不调用**，token 落地即 authed
> - UMA 市场只换接口 path；前端合约调用移除
>
> 实施阶段从 7 个缩减到 4 个：P0（已完成）/ P1-Cancel / P3-CTF / P4-下单 / P5-UMA；**原 P1.2 余额 / P1.3 订单查询 / P2 活动拆分 / P6 持仓全部取消**。
>
> ---
>
> 输入：[tob-controller-api.md](./tob-controller-api.md) + [tob-controller-api-diff.md](./tob-controller-api-diff.md)

---

## 0. 实施总原则

1. **不直接改业务页面**，所有 To-B HTTP 接口集中在 `lib/services/tob/*`；业务层 hook 通过它转一层，便于 mock / 联调 / 回滚。
2. **mock 优先**：所有新接口都带 `USE_MOCK` 分支，前端独立联调；后端 ready 后切真接口仅改 env。
3. **类型即契约**：所有接口对应 `TobXxxReq / TobXxxResp` TS 类型。
4. **保留旧接口的同时引入新接口**：用 feature flag (`NEXT_PUBLIC_TOB_USE_NEW_CANCEL` / `..._MARKET`) 切换灰度。
5. **每个能力点改造完都要写最小回归用例**（手测脚本 / mock-parent.html 入口）。

---

## 1. 目录结构（最终态）

```
lib/services/
  tobApi.ts                  # 已存在（FR-2/FR-4），本期扩展
  tob/
    tobOrders.ts             # §2 / §4 订单 + 查询
    tobOrderActions.ts       # §2 split/merge/redeem
    tobOrderCancel.ts        # §3 取消
    tobBalance.ts            # §4.1-4.2（替换 FR-4 部分）
    tobChainActions.ts       # §4.6-4.7
    tobTransfers.ts          # §4.8-4.9
    tobUmaMarket.ts          # §5
    types.ts                 # 共享 TS 类型 + status 枚举
    mock/                    # 各接口 mock 数据
lib/hooks/tob/
  use-tob-orders.ts          # 替换 useGetActivity 的"订单"部分
  use-tob-actions.ts         # 替换 useGetActivity / useGetChainTransactions 的"链上"部分
  use-tob-transfers.ts       # 替换 useGetActivity / useGetChainTransactions 的"划转"部分
  use-tob-balance.ts         # 替换 lib/hooks/useTobBalance.ts（命名兼容旧接口）
  use-tob-positions.ts       # 待 Q2 答复后实现
  use-tob-cancel.ts
  use-tob-create-order.ts
  use-tob-uma-create.ts
  use-tob-action-status.ts   # poll /action/status
docs/
  tob-controller-api.md            # 后端给的接口规范
  tob-controller-api-diff.md       # 字段差异 + 待澄清
  tob-controller-api-impl-plan.md  # 本文档
```

---

## 2. 阶段划分

### 🟢 P0（先做，不依赖待澄清问题）— 1 天

**目标**：搭好类型骨架 + mock 闭环 + 老的简单替换。

| 步骤 | 内容                                                                                | 依赖 |
| ---- | ----------------------------------------------------------------------------------- | ---- |
| P0.1 | 建 `lib/services/tob/types.ts`，把所有 `TobXxxReq / TobXxxResp` TS 类型按文档录入   | —    |
| P0.2 | 建 `lib/services/tob/mock/`，给每个接口写 mock 返回（数据可写死，10-20 条样本）       | —    |
| P0.3 | 建 8 个对应 service 文件，统一 `if (USE_MOCK) return mockX(); else return http.get/post(...)` | P0.1 |
| P0.4 | 建 `lib/services/tob/index.ts` re-export，对外只暴露 `tobApi.*` 命名空间             | P0.3 |
| P0.5 | 写 `lib/hooks/tob/` 的 8 个 hook（`useTobXxx`），保持和现有 hook（`useGetActivity` 等）相同的 `{ data, loading, error, refresh }` 形态 | P0.3 |
| P0.6 | 添加 feature flag `NEXT_PUBLIC_TOB_USE_NEW_QUERY=0/1`；env 文档更新                  | —    |

**验收**：
- `pnpm dev` + mock 模式下，新 hook 能返回数据；现有页面零影响。
- TypeScript 全绿；新增类型符合 `tob-controller-api.md` 表格。

---

### 🟡 P1（核心替换）— 取消 + 余额 + 订单查询，2 天

> 必须先有 [Q1（cancel betId 映射）](./tob-controller-api-diff.md#q1取消订单-id-语义)、[Q5（balance 字段语义）](./tob-controller-api-diff.md#q5余额接口字段语义)、[Q8（auth/verify 是否保留）](./tob-controller-api-diff.md#q8auth-verify--wallet-address-接口)的答复。

#### P1.1 取消订单（§3.1）

- 替换 `lib/api.ts:228 cancelOrderApi`，新签名 `cancelOrderByBetId(betId: string)`。
- **关键决策**（依 Q1 答复）：
  - 选项 A（推荐）：要求后端在 `TobOrderItemResp` 上加 `betId`，`useTobOrders` 返回直接带 `betId`。
  - 选项 B：前端自己维护 `orderId ↔ betId` 映射表，从 `TobOrderCreateResp.betId` 落库。
- 调用点：`app/pna/components/OrderBookTab.tsx`、订单卡 Cancel 按钮。
- 入参从 `orderId` 改成 `betId`，并替换返回值判断从 `data === true` 改为 `data.status === 'CANCELED'`。

#### P1.2 余额展示（§4.1-4.2）

- **依 Q5 答复决定改造方式**：
  - 若 `cash` ≈ 渠道现金、`portfolio` ≈ 持仓估值：FR-4 方案 A 主显 `cash`，方案 B 展开两档（不再是三档）。
  - 若后端补三档字段：保持 FR-4 现状，仅改 path。
- 改造 `lib/services/tobApi.ts:147 getBalance`：
  - path 改成 `/api/tob/query/balances/user?userId=`
  - resp 类型从 `TobBalanceBreakdown` 切到 `TobUserBalanceItemResp`
- 改造 `lib/hooks/useTobBalance.ts`：返回字段同步调整。
- 改造 `components/embed/EmbedBalanceBadge.tsx`：展开面板列名按 Q5 答复改。

#### P1.3 订单查询（§4.3-4.5）

- 替换 `lib/api.ts:149 getUnfinishedOrders`，新签名走 `/api/tob/query/orders/user`。
- 调用点：所有 PNA 订单簿、未完成订单卡片。
- 已知字段缩减：`orderType / orderPrice / outComeUnionKey / completedAt / eventId / 各种 fee` 全无。
  - **临时降级**：UI 列暂时显示 "—"；
  - **正式方案**：在 [tob-controller-api-diff.md Q9-Q10](./tob-controller-api-diff.md#5-待澄清问题清单) 答复落实后再补。

#### P1.4 SSO 调整（依 Q8 答复）

- 若 `auth/verify` 不再存在：删 `lib/services/tobApi.ts:137 verifyAuth`，把 `lib/embed/EmbedContext.tsx:212` 的"收到 embed:auth → 调 verify"改成"直接进 authed"，wallet 地址改从首个 `/balances/user` 调用获取。
- 若 verify 仍在但接口不同：保留路径切换。

**验收**：
- `EmbedBalanceBadge` 显示真实 / mock 数据无报错；下单 / 取消后通过 `notifyEmbedBalanceRefresh()` 触发重拉。
- 取消订单按钮调通（mock 立即返回 `status='CANCELED'`）。
- 未完成订单列表能渲染（缺字段处显示占位）。

---

### 🟡 P2（活动 / 链上动作 / 划转拆分）— 1.5 天

> 依 [Q3 / Q4](./tob-controller-api-diff.md#q3activity-拆-3-接口的字段补全) 答复。

- **目标**：把现有 `useGetActivity` 拆成三个 hook 各取所需。
- **UI 决策**：
  - 选项 A（推荐）：`app/pna/components/activity-table.tsx` 改成 3 个 Tab（成交 / 链上 / 划转），各调一个新 hook。
  - 选项 B：保持单表，前端写 merger 把三个接口的 list 按 `timestamp` 归并。
- 缺失字段（市场名 / outcomeName / icon / question）的处理：
  - 短期：基于 `marketId` 在前端 `marketCache` 里查一次；
  - 长期：等后端补字段。
- 同步替换 `lib/api.ts:304 getChainTransactions` → `useTobActions + useTobTransfers`。

**验收**：
- 活动页（`/pna` 等）切到新接口后视觉一致；链上 tab 能看到 SPLIT/MERGE/REDEEM；划转 tab 能看到 DEPOSIT/WITHDRAW。

---

### 🟡 P3（CTF 动作 + Action 状态轮询）— 1 天

> 纯新增，不替换。依 [Q6](./tob-controller-api-diff.md#q6ctf-split--merge--redeem-的-betid-来源) 答复。

- 实现 `useTobOrderActionSplit / Merge / Redeem`：
  - 触发点：`positions-table.tsx:66 canClaim` 旁加按钮，或单独详情页。
  - 调用 `POST /api/tob/order/{split,merge,redeem}` → 拿 `actionId`。
- 实现 `useTobActionStatus(betId)`：
  - 轮询 `GET /api/tob/order/{betId}/action/status`（建议 3-5s 间隔，最多 30 次或直到 `status==='COMPLETED'`/`FAILED`）。
  - 完成后触发 `notifyEmbedBalanceRefresh()` + 刷新持仓。

**验收**：
- 在 mock 模式下点 Redeem → 看到 actionId → 5s 内看到 status COMPLETED → 余额刷新。

---

### 🟠 P4（下单接入）— 2 天

> 依 [Q7（beltId 拼写）/ Q10（expiryTime / orderFlags / clobPairId 含义）](./tob-controller-api-diff.md#q7beltid-字段名) 答复。

- 实现 `useTobCreateOrder({ tokenId, side, amount, size, ... })`：
  - 自动生成 `clientId = uuid()` 作为幂等键；落地 `betId` 用于后续 cancel / split。
  - 调 `POST /api/orders/tob/order/create`。
- UI 接入：替换原本"链上 SDK 直签直下"的 PlaceOrder 按钮（如有）。
- 错误处理：`channelTxHash` 没拿到时 UI 显示"等渠道扣款"；`bridgeBacTxHash` 进展显示等。
- 下单成功后调 `notifyEmbedBalanceRefresh()` 立即刷余额。

**验收**：
- mock 模式下点 Place Order → 拿到 `betId / status='channel_deducted'` → 状态机推进可视化。

---

### 🟠 P5（UMA 市场创建合并）— 2 天

> 依 [Q11 / Q12](./tob-controller-api-diff.md#q11uma-市场创建sports-分支不再-review) 答复。

- 替换三处现有调用：
  - `createMarketV2` → `tobUmaCreate({ type: 'common', ...common 分支字段 })`
  - `createCryptoMarket` → `tobUmaCreate({ type: 'crypto', ...crypto 分支字段 })`
  - `reviewSportsMarket + createMarketV2` 两步合并 → `tobUmaCreate({ type: 'sports', gameId, markets })`
- UI 决策：sports 创建若不再有"review 拿 unique_key"，要从体育详情页**直接拿到 `gameId`**，否则 sports tab 暂保留旧流程直到 Q11 明确。
- common 分支增加 `liveness` 输入项（>0 必填）。
- crypto 分支把 `marketValue` 输入改成 `targetRule` 字符串构造器（前端表单里给"Above / Below / Range / First Hit"选项，自动拼 `GT:xxx` 等）。

**验收**：
- 三种类型都能用统一 hook 创建；mock 返回 `marketIds + questionIds`；事件页能跳转。

---

### 🟢 P6（持仓视图）— 待 Q2 答复

- 选项 A：后端补 `/api/tob/query/positions/user` → 直接 1:1 替换。
- 选项 B：前端基于 `orders/user` + `actions/user` 自行聚合（按 tokenId 汇总 filledSize - redeemedSize），`canClaim` 走链上调用。
  - 复杂度高，建议争取选项 A。

---

## 3. 切换策略（feature flag）

```env
# .env.local 或 .env.production
NEXT_PUBLIC_TOB_USE_MOCK=1            # 现有，FR-2/FR-4 mock 总开关
NEXT_PUBLIC_TOB_USE_NEW_QUERY=0       # 新增：1=查询走新 To-B 接口；0=保留老 (lib/api.ts)
NEXT_PUBLIC_TOB_USE_NEW_CANCEL=0      # 新增：取消订单切换
NEXT_PUBLIC_TOB_USE_NEW_BALANCE=0     # 新增：余额切换
NEXT_PUBLIC_TOB_USE_NEW_MARKET=0      # 新增：市场创建切换
```

每个 flag 控制一组 hook：

```ts
// lib/hooks/useTobBalance.ts（伪码）
const useNew = process.env.NEXT_PUBLIC_TOB_USE_NEW_BALANCE === "1";
return useNew ? useTobBalanceV2() : useTobBalanceV1();
```

灰度顺序建议：先 P1.2 余额（影响面小） → P1.1 取消（影响中） → P2 活动表（影响大但可视化）→ P4/P5（新功能）。

---

## 4. 风险与回滚

| 阶段     | 风险                                                                   | 回滚                                                |
| -------- | ---------------------------------------------------------------------- | --------------------------------------------------- |
| P1.2     | 新 balance 字段语义和 UI 不匹配                                          | feature flag 切回；保留 `tobApi.getBalance` 旧实现   |
| P1.1     | `betId` 映射缺失 → cancel 直接 404                                      | feature flag 切回 router /order/cancel              |
| P2       | activity 三接口合并性能差                                              | 单 tab 模式（先只显示订单 tab，其他 disabled）       |
| P4       | 下单接口的 `expiryTime / orderFlags` 后端规则未对齐 → 直接 422             | 不上线 P4，等后端先稳定                              |

每个 PR 必须可独立回滚（feature flag 关掉即旧逻辑）。

---

## 5. 工时估算

| 阶段 | 工时 | 阻塞依赖                  |
| ---- | ---- | ------------------------- |
| P0   | 1d   | —                         |
| P1   | 2d   | Q1 / Q5 / Q8              |
| P2   | 1.5d | Q3 / Q4                   |
| P3   | 1d   | Q6                        |
| P4   | 2d   | Q7 / Q9 / Q10             |
| P5   | 2d   | Q11 / Q12                 |
| P6   | 0.5-3d | Q2（取决于 A/B 选项）   |

总：8-11 人日（不含等后端答复时间）。

---

## 6. 验收清单（联调里程碑）

每个阶段完成后，在 mock 模式 + 真接口模式各跑一遍：

- [ ] mock 模式：mock-parent.html → embed:auth → 看到余额 / 订单 / 活动 / 持仓
- [ ] 真接口（dev 后端 ready 后）：用 dev JWT 替换，每个接口至少一次 200 + 一次 401 重放（FR-2.3）
- [ ] feature flag 关闭后能完全回到旧 C 端调用，无残留 `/api/tob/...` 请求

---

## 7. 与之前 FR 阶段的关系

| 已交付            | 本计划是否影响                                                         |
| ----------------- | ---------------------------------------------------------------------- |
| FR-1 iframe 通信  | 不影响（仍由 `lib/embed/*` 持有）                                       |
| FR-2 SSO          | P1.4 可能删除 `verifyAuth` 调用（依 Q8）                                |
| FR-4 余额         | P1.2 整体改造（依 Q5）；可能 `tradeChain/bac` 字段从前端类型移除          |

---

## 8. 待办（执行此计划前）

1. ⏸ **把 [tob-controller-api-diff.md §5 Q1-Q14](./tob-controller-api-diff.md#5-待澄清问题清单) 发给后端**，要求 1-2 天内回复。
2. ⏸ 收齐答复后，更新本文档 §2 各阶段的具体字段映射。
3. ▶ 启动 P0（不依赖任何答复，可立刻开工）。
