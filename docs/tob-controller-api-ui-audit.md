# To-B Controller API · UI 接入点核查结论

> 目的：记录 P3 / P4 / P5 在 `yesono-embed` 仓库内的"现有 UI 接入点"核查证据，避免后续决策时重复调查。
>
> 核查时间：2026-05-11
> 核查范围：`yesono-embed` 全仓（`app/**`、`components/**`、`lib/**`）
> 关联文档：`docs/tob-controller-api-diff.md`、`docs/tob-controller-api-impl-plan.md`

## 一句话结论

**`yesono-embed` 是只读嵌入态版本，所有写操作 UI 都被刻意阉割。** P3 / P4 / P5 在本仓库内 **没有可替换的旧实现**——既没有 UI 入口，也没有旧的 API 调用点。P1（取消订单）是唯一例外，旧调用尚存，已通过 flag shim 完成替换。

## 一、各 P 项现状映射

| 接口 | 旧 UI / 旧 API 是否存在 | 处置 |
| --- | --- | --- |
| **P1 取消订单** | ✅ `lib/api.ts` 中 `cancelOrderApi` 仍有调用 | ✅ 已通过 flag shim `NEXT_PUBLIC_TOB_USE_NEW_CANCEL` 完成 |
| **P3 拆 / 合 / 赎回（CTF）** | ❌ 无 UI 入口、无旧 API 调用 | ⏸ service/hook 骨架已就位，UI 留给上游或新建 |
| **P4 创建订单（下单）** | ❌ 移动端 sheet 是占位文案；桌面端不渲染面板 | ⏸ 同上 |
| **P5 UMA 市场创建** | ❌ 仓库内无 `create market` 路由/页面 | ⏸ `lib/services/marketService.ts` 已留接入注释 |

## 二、关键证据

### 1. 移动端"交易面板" = 占位文案

`components/sports/GamesView/index.tsx` 共 4 处把 `showMobileTrading` 弹窗内容写死为提示：

```@/Users/kksthinkpad/res/code/js/yesono-embed/components/sports/GamesView/index.tsx:521
              <div className="text-xs text-(--text-tertiary) py-4 text-center">Trading disabled in embedded view</div>
```

其他 3 处：`:478`、`:730`、`:774`。

所有 Buy 按钮（如 `app/market/[id]/outcome/[outcomeIndex]/OutcomeBottomBuyBar.tsx:39-51`、`app/market/[id]/page.tsx:213-217`）的最终行为都只是 `setShowMobileTrading(true)`，弹出来的就是这块占位 div。

### 2. 桌面端右侧栏不含交易面板

`app/market/[id]/page.tsx:625-661` 注释写着 "未解决显示交易面板"，但实际只渲染 `RelatedMarkets`。仓库内 grep `OrderForm|TradingPanel|TradeSheet|BuyPanel` 均无组件命中（`MobileTrading` 仅作为状态名出现在三处 `useState`）。

### 3. 订单 / 持仓表只展示，不操作

- `app/pna/components/orders-table.tsx:141-150`：取消按钮 `disabled`，未绑定 `onClick`。
- `app/pna/components/positions-table.tsx:66-70`：仅渲染 `canClaim` 徽章，无 claim 按钮。
- `app/pna/components/OrderCard.tsx:265-274`：仅渲染 "✓ 已领取" / "可领取" 徽章，无领取按钮。
- `app/pna/components/OrderBookTab.tsx`：保留 `setIsClaimingTx` / `setIsClaimingAll` 等 `useState` setter，但其 setter **未被任何按钮的 `onClick` 调用**，仅剩残留状态名。

### 4. 无市场创建路由

- `app/` 下不存在 `create` / `market/new` / `admin` 等目录。
- 全仓 grep `createMarket|submitMarket|/market/create` 0 命中。
- `lib/services/marketService.ts` 内仅有读类与 `cancelOrder` 等，无 `placeOrder` / `redeem` / `split` / `merge` / `createUmaMarket` 类调用。

## 三、与"功能已经实现，仅需替换接口"的差异原因（推测）

最可能的情况是：上游主站项目（如 `h2-market`）才有完整的下单面板与市场创建后台，本 `yesono-embed` 是为 iframe 嵌入派生的精简只读版本，写操作 UI 在派生时被去除。`tob-controller-api-impl-plan.md` 假设的"原有功能接口"指的是**主站**而非 embed。

## 四、后续推进的三条路径

1. **在本仓库新建写入 UI**：在 embed 中补齐下单面板、拆/合/赎回按钮、UMA 创建页面，直接对接新 To-B 接口。工作量大，等价于把主站功能搬入 embed。
2. **仅完成接口/Hook 层（推荐保守路径）**：保留 `lib/services/tob/**` + `lib/hooks/tob/**` 骨架与 P1 shim，等待主站接入时复用。当前已处于此状态。
3. **跨仓库执行替换**：到主站仓库定位旧调用点再替换。需要由用户提供主站仓库路径。

## 五、当前已落地的工件清单

- `lib/services/tob/{types,mock,tobOrders,tobOrderActions,tobOrderCancel,tobUmaMarket,index}.ts`
- `lib/hooks/tob/{useAsyncResource,useTobMutation,useTobOrderCancel,useTobOrderActions,useTobCreateOrder,useTobUmaCreate,index}.ts`
- `lib/api.ts` 中 `cancelOrder` flag-aware shim（P1 已生效）
- `lib/services/marketService.ts` 中 P5 接入指引注释
- `.env.example` 新增 `NEXT_PUBLIC_TOB_*` 系列 flag

## 六、再次调查时的快速复核命令

```bash
# 1) 移动端交易占位文案
rg -n "Trading disabled in embedded view" components app

# 2) 是否存在下单/创建市场组件
rg -n "OrderForm|TradingPanel|TradeSheet|BuyPanel|createMarket|submitMarket" app components

# 3) 是否存在 claim/redeem/split/merge 按钮（onClick 绑定）
rg -n "onClick.*\b(claim|redeem|split|merge)\b" app components

# 4) 旧 placeOrder / 下单 API 调用
rg -n "placeOrder|createOrder|submitOrder" lib app components
```

若上述命令仍 0 命中，则本文档结论依旧成立，无需重新调查。
