"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { hapticImpact, hapticNotification } from "@/lib/native/capacitor-bridge";
import { createOrderNew, getUserCtfBalance } from "@/lib/api";
import type { CreateOrderTx, CreateOrderToken } from "@/lib/api";
// To-B 控制器：下单走 /api/orders/tob/order/create 替代老的 createOrderNew + 链上流程
import { tobApi } from "@/lib/services/tob";
// yesono-embed 不引入 viem；inline 6-decimal helpers（USDC/USDT quantums 统一 6 精度）
function parseUnits(value: string, decimals: number): bigint {
  const [whole = "0", frac = ""] = String(value).split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole) * BigInt(10) ** BigInt(decimals) + BigInt(padded || "0");
}
function formatUnits(value: bigint, decimals: number): string {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const base = BigInt(10) ** BigInt(decimals);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  const s = frac ? `${whole}.${frac}` : String(whole);
  return neg ? "-" + s : s;
}
import { Switch } from "@/components/ui/Switch";
import {
  BadgeDollarSign,
  ChevronDown,
  ChevronRight,
  Info,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
// yesono-embed 没有 Privy：iframe 场景通过父页 embed:auth 注入 JWT，
// 已认证 = EmbedContext.status === "authed"。保留 usePrivy 同名 stub 让 UI 分支不用改。
import { useEmbed } from "@/lib/embed/EmbedContext";
const usePrivy = () => {
  const { status } = useEmbed();
  return {
    authenticated: status === "authed",
    ready: status !== "idle",
    login: () => {
      // 未认证：让父页重新下发渠道 JWT
      if (typeof window !== "undefined") {
        window.parent?.postMessage(
          { v: 1, type: "embed:auth-required", reason: "missing" },
          "*"
        );
      }
    },
  };
};
import GameButton from "@/components/sports/Live/GameButton";
import { Popover } from "@/components/ui/Popover";
import Tabs from "@/components/ui/Tabs";
import MergeShares from "./MergeShares";
import SplitShares from "./SplitShares";
import { useTradingStore } from "@/lib/store/tradingStore";
import { useToast } from "@/components/ui/Toast";
import ProxyImage from "@/components/common/ProxyImage";
import { useDydx } from "@/lib/hooks/useDydx";
import {
  getOutcomeLabel,
  normalizeBinaryOutcomeLabel,
  sortOutcomesByOriginalIndex,
} from "@/lib/utils/outcomes";
import { openLoginModalWithTrack } from "@/lib/sentryClient";
import { trackEvent } from "@/lib/sentryClient";

type OrderType = "market" | "limit";
type TradeType = "buy" | "sell";

/**
 * 「待执行下单意图」有效期：用户点下单时未登录 / token 失效 → 通知父页续期，
 * 在这个时间窗内拿到新 token 就自动把那一单补发。超过则视为用户已放弃，不自动下单
 * （避免隔很久突然弹出一笔成交吓到用户）。
 */
const PENDING_TRADE_TTL_MS = 90_000;

function parseExpiration(
  expiration: string,
  endDate?: string | number
): number {
  if (!expiration) return 60; // Default 60s

  if (expiration === "End of day") {
    const now = new Date();
    // 如果有市场结束时间,使用市场结束时间
    if (endDate) {
      const end = new Date(endDate);
      const diff = Math.floor((end.getTime() - now.getTime()) / 1000);
      return diff > 0 ? diff : 60;
    }
    // 否则默认为当天结束
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const diff = Math.floor((endOfDay.getTime() - now.getTime()) / 1000);
    return diff > 0 ? diff : 60;
  }

  const match = expiration.match(/^(\d+)([mh])$/);
  if (match) {
    const val = parseInt(match[1]);
    const unit = match[2];
    if (unit === "m") return val * 60;
    if (unit === "h") return val * 3600;
  }

  // 尝试直接解析数字
  const val = parseInt(expiration);
  if (!isNaN(val) && val > 0) return val;

  return 60;
}

export default function TradingPanel({
  questionID,
  hideHeader,
}: {
  questionID: string;
  hideHeader?: boolean;
}) {
  const {
    event,
    market,
    direction,
    setDirection,
    setSelectOutcomeId,
    getOrderBook,
    selectOutcomeId,
    orderBookRaw,
  } = useTradingStore();
  const toast = useToast();
  // embed 不读 USDT 现金余额（买单 USDT 扣减由父页面统一控制）；
  // 但 CTF 代币持仓（YES/NO shares）仍需在这边查询：卖单要知道"我有多少股可卖"。
  const isTrading = false;
  // 获取 YES 和 NO 的实时订单簿价格
  const clobTokenIds = useMemo(() => {
    return JSON.parse(market?.clobTokenIds || "[]") as string[];
  }, [market?.clobTokenIds]);
  // 根据 originalIndex 排序后的 outcome，统一确定标签
  const parsedMarketOutcomes = useMemo(() => {
    const raw: any = (market as any)?.marketOutcomes;
    if (Array.isArray(raw)) return raw as any[];
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [market]);

  const sortedOutcomes = useMemo(
    () => sortOutcomesByOriginalIndex(parsedMarketOutcomes as any[]),
    [parsedMarketOutcomes]
  );
  // 订单簿 key 必须与 WS 推送的 asset_id 一致：当前是 marketOutcomes.tradingPair（如 `${marketId}-YES-USDT`）
  // clobTokenIds 是链上 tokenId（超长数字），无法用来索引 WS 订单簿。
  const [yesObKey, noObKey] = useMemo(() => {
    const yes = sortedOutcomes.find((o: any) => Number(o?.originalIndex) === 0);
    const no = sortedOutcomes.find((o: any) => Number(o?.originalIndex) === 1);
    return [String(yes?.tradingPair || yes?.tokenId || ""), String(no?.tradingPair || no?.tokenId || "")] as const;
  }, [sortedOutcomes]);

  const yesOrderbook = getOrderBook(yesObKey || ""); // YES 的订单簿（WS tradingPair）
  const noOrderbook = getOrderBook(noObKey || ""); // NO 的订单簿（WS tradingPair）

  const { t } = useTranslation();

  const [yesLabel, noLabel] = useMemo(() => {
    if (sortedOutcomes.length >= 2) {
      const label0 = getOutcomeLabel(sortedOutcomes[0]);
      const label1 = getOutcomeLabel(sortedOutcomes[1]);
      return [
        normalizeBinaryOutcomeLabel(label0, t.common.yes, {
          yes: t.common.yes,
          no: t.common.no,
          up: t.common.up,
          down: t.common.down,
        }),
        normalizeBinaryOutcomeLabel(label1, t.common.no, {
          yes: t.common.yes,
          no: t.common.no,
          up: t.common.up,
          down: t.common.down,
        }),
      ];
    }
    return [t.common.yes, t.common.no];
  }, [
    sortedOutcomes,
    t.common.yes,
    t.common.no,
    t.common.up,
    t.common.down,
  ]);
  const { login, authenticated } = usePrivy();
  // 直接取 embed 续期通道 + token：未登录/401 时记录下单意图，新 token 到达后自动续上
  const { requestAuthRefresh, token: embedToken } = useEmbed();
  const [orderType, setOrderType] = useState<OrderType>("market");

  // Local state for form inputs
  const [amount, setAmount] = useState<string>("");
  const [limitPrice, setLimitPrice] = useState<string>("");
  const [errors, setErrors] = useState<{
    amount?: string;
    limitPrice?: string;
    outcome?: string;
  }>({});

  const [expirationEnabled, setExpirationEnabled] = useState(false);
  const [expirationTime, setExpirationTime] = useState("5m");
  const [expirationPopoverOpen, setExpirationPopoverOpen] = useState(false);

  const [splitSharesDialogOpen, setSplitSharesDialogOpen] =
    useState<boolean>(false);
  const [mergeSharesDialogOpen, setMergeSharesDialogOpen] =
    useState<boolean>(false);

  const [orderTypePopoverOpen, setOrderTypePopoverOpen] =
    useState<boolean>(false);

  // 本地提交状态，点击后立即 loading
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // CTF 代币持仓（YES/NO shares）：卖单 MAX / 校验依赖这个值
  // number 单位是 shares（与 h2-market 一致：getUserCtfBalance 返回 string，直接 parseFloat）
  const [tokenBalance, setTokenBalance] = useState<number>(0);

  // 待执行下单意图（未登录 / token 失效时记录），新 token 到达后自动续上
  const pendingTradeAtRef = useRef<number | null>(null);
  // 镜像最新的 handleTradingClick，给 auto-resume effect 调用（避免闭包陈旧）
  const handleTradingClickRef = useRef<() => void>(() => {});
  // 「等待登录后自动下单」UI 态：按钮转圈 + 文案提示
  const [resumingAfterAuth, setResumingAfterAuth] = useState(false);

  // Clear form when market changes
  useEffect(() => {
    setAmount("");
    setLimitPrice("");
    setErrors({});
    setTokenBalance(0);
  }, [market?.id, questionID]);

  // 取当前选中 outcome 的 unionKey（getUserCtfBalance 需要这个）
  const selectedUnionKey = useMemo(() => {
    const list: any[] = parsedMarketOutcomes || [];
    return (
      list.find((o) => String(o?.tokenId) === String(selectOutcomeId))
        ?.unionKey || ""
    );
  }, [parsedMarketOutcomes, selectOutcomeId]);

  // 拉取 CTF 持仓的方法：返回最新值 + 同步到 state
  const fetchTokenBalance = async (): Promise<number> => {
    if (!authenticated || !selectedUnionKey) return 0;
    try {
      const resp = await getUserCtfBalance(selectedUnionKey);
      if (resp.success && resp.data !== undefined && resp.data !== null) {
        const n = parseFloat(String(resp.data));
        const safe = Number.isFinite(n) ? n : 0;
        setTokenBalance(safe);
        return safe;
      }
      return tokenBalance;
    } catch (e) {
      console.error("[TradingPanel] Failed to fetch token balance", e);
      return tokenBalance;
    }
  };

  // SELL 方向 / 切换 outcome / 登录态变更时自动拉一次最新持仓
  useEffect(() => {
    if (direction !== "SELL") return;
    if (!authenticated || !selectedUnionKey) {
      setTokenBalance(0);
      return;
    }
    void fetchTokenBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction, selectedUnionKey, authenticated]);

  const items: [TeamInfo, TeamInfo] = useMemo(() => {
    const prices = (JSON.parse(market?.outcomePrices || "[]") as (number | string)[]).map(Number);

    // outcomePrices 顺序与 outcomes 一致：prices[0]=Yes(originalIndex=0), prices[1]=No(originalIndex=1)
    // 不能用 marketOutcomes 的数组位置去索引 prices，因为 marketOutcomes 顺序可能不同
    const yesStaticPrice = prices[0] ?? 0;
    const noStaticPrice = prices[1] ?? 0;

    // 实时 orderbook 价格（用于交易执行）
    const yesLivePrice =
      yesOrderbook && yesOrderbook.bestAsk > 0
        ? yesOrderbook.bestAsk
        : yesStaticPrice;
    const noLivePrice =
      noOrderbook && noOrderbook.bestAsk > 0
        ? noOrderbook.bestAsk
        : noStaticPrice;

    return [
      {
        name: yesLabel,
        price: yesLivePrice,
        labelPrice: yesStaticPrice,
        buyPrice: yesOrderbook?.bestAsk || yesStaticPrice,
        sellPrice: yesOrderbook?.bestBid || yesStaticPrice,
        color: "#22c55e",
        value: clobTokenIds[0] || "",
        type: "YES",
      },
      {
        name: noLabel,
        price: noLivePrice,
        labelPrice: noStaticPrice,
        buyPrice: noOrderbook?.bestAsk || noStaticPrice,
        sellPrice: noOrderbook?.bestBid || noStaticPrice,
        color: "#ef4444",
        value: clobTokenIds[1] || "",
        type: "NO",
      },
    ];
  }, [market, clobTokenIds, yesOrderbook, noOrderbook, yesLabel, noLabel]);

  const selectedPrice = useMemo(() => {
    const selectedItem = items.find((i) => i.value === selectOutcomeId);

    if (!selectedItem) return 0;

    // 买单使用最优卖价(bestAsk)，卖单使用最优买价(bestBid)，回退到 mid price
    if (direction === "BUY") {
      return selectedItem.buyPrice ?? selectedItem.price ?? 0;
    }

    return selectedItem.sellPrice ?? selectedItem.price ?? 0;
  }, [items, selectOutcomeId, direction]);

  // 如果 selectOutcomeId 在别处（例如 OutcomeList）被改变，且当前为限价单且用户尚未填写 limitPrice，
  // 则用选中 outcome 的显示价填充 limitPrice（与 handleTokenSelect 行为一致）
  // 使用 Ref 记录上一次的选择，以便区分是“切换了选项”还是“仅仅是价格变动”
  const prevOutcomeRef = useRef(selectOutcomeId);
  const prevDirectionRef = useRef(direction);
  // 记录用户是否手动修改过价格。如果用户手动改过/清空过，且没有切换选项，系统就不应自动覆盖。
  const isManualEditRef = useRef(false);

  // 提取需要自动填充的目标价格，作为基本类型传入依赖数组，避免 items 引用不稳定导致的死循环
  const selectedItemForAutoFill = items.find(
    (i) => i.value === selectOutcomeId
  );
  const autoFillDisplayPrice = selectedItemForAutoFill
    ? direction === "BUY"
      ? selectedItemForAutoFill.buyPrice ?? selectedItemForAutoFill.price
      : selectedItemForAutoFill.sellPrice ?? selectedItemForAutoFill.price
    : 0;

  // 修改依赖项原始值的计算方式，同样不进行四舍五入，保留精度以便 useEffect 比较
  const autoFillPriceRaw = (autoFillDisplayPrice ?? 0) * 100;
  // 这里作为依赖项的 key，为了避免浮点数比较问题，可以保留较多位小数的字符串
  const autoFillPriceKey = autoFillPriceRaw.toFixed(4);

  useEffect(() => {
    if (orderType !== "limit") return;
    if (!selectOutcomeId) return;

    const isSelectionChange =
      prevOutcomeRef.current !== selectOutcomeId ||
      prevDirectionRef.current !== direction;
    prevOutcomeRef.current = selectOutcomeId;
    prevDirectionRef.current = direction;

    // 如果切换了选项，重置手动修改标记，允许系统重新填充
    if (isSelectionChange) {
      isManualEditRef.current = false;
    }

    // 中文注释（优化逻辑）：
    // 1. 如果用户已经手动编辑过（包括清空），且这只是一个“市场价格变动”而不是“切换选项”，
    //    我们就不要去干扰用户的输入。
    if (!isSelectionChange && isManualEditRef.current) {
      return;
    }

    const selectedItem = items.find((i) => i.value === selectOutcomeId);
    if (!selectedItem) return;

    const displayPrice =
      direction === "BUY"
        ? selectedItem.buyPrice ?? selectedItem.price
        : selectedItem.sellPrice ?? selectedItem.price;

    // 修改为保留 1 位小数 (e.g. 54.3)，并将值限制到 [0.1, 99.9]
    const centsRaw = (displayPrice ?? 0) * 100;
    if (centsRaw > 0) {
      let centsNum = parseFloat(centsRaw.toFixed(1));
      // clamp to allowed range (¢)
      centsNum = Math.max(0.1, Math.min(99.9, centsNum));
      const centsStr = Number.isInteger(centsNum)
        ? centsNum.toString()
        : centsNum.toFixed(1);
      setLimitPrice((prev) => (prev === centsStr ? prev : centsStr));
      setErrors((prev) =>
        prev.limitPrice ? { ...prev, limitPrice: undefined } : prev
      );
    } else {
      setLimitPrice("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectOutcomeId, orderType, direction, autoFillPriceKey]); // 使用 autoFillPriceKey 字符串作为依赖

  function handleTokenSelect(value: string) {
    setSelectOutcomeId(value);
    setErrors((prev) => ({ ...prev, outcome: undefined }));

    // 如果当前是限价单，点击 outcome 按钮时把按钮显示的价格填入 limitPrice 输入框
    if (orderType === "limit") {
      const selected = items.find((i) => i.value === value);
      if (selected) {
        const displayPrice =
          direction === "BUY"
            ? selected.buyPrice ?? selected.price
            : selected.sellPrice ?? selected.price;
        // limitPrice 存储为分 (¢)，支持小数（最多 1 位小数），并限制到 [0.1, 99.9]
        const centsRaw = (displayPrice ?? 0) * 100;
        if (centsRaw > 0) {
          let centsNum = parseFloat(centsRaw.toFixed(1));
          centsNum = Math.max(0.1, Math.min(99.9, centsNum));
          const centsStr = Number.isInteger(centsNum)
            ? centsNum.toString()
            : centsNum.toFixed(1);
          setLimitPrice(centsStr);
        } else {
          setLimitPrice("");
        }
        setErrors((prev) => ({ ...prev, limitPrice: undefined }));
      }
    }
  }

  async function handleTradingClick() {
    if (!authenticated) {
      // embed 在 iframe 里没法自己弹登录：记录这一单的意图 + 通知父页拉起登录，
      // 登录拿到新 token 后由 auto-resume effect 自动把单补发，做到「无感续单」。
      // 走 requestAuthRefresh（authQueue 去重 + 标准 ChildMsgType.AuthRequired），
      // 不再用 login() 裸 postMessage，避免与 401 续期重复发 auth-required
      pendingTradeAtRef.current = Date.now();
      setResumingAfterAuth(true);
      requestAuthRefresh("missing");
      toast.info(
        t.common?.orderResumeAfterLogin ??
          "Log in via the host page — your order will be placed automatically"
      );
      return;
    }

    // Validation
    const newErrors: typeof errors = {};
    if (!selectOutcomeId) {
      newErrors.outcome =
        t.trade.errorSelectOutcome || "Please select an outcome";
    }

    const amountVal = parseFloat(amount);
    if (!amount || isNaN(amountVal) || amountVal <= 0) {
      newErrors.amount = t.trade.errorInvalidAmount || "Enter a valid amount";
    }

    // 卖单：用 CTF 持仓校验「股数不足」；买单的 USDT 余额校验交给父页面
    if (direction === "SELL" && !newErrors.amount) {
      // 先用本地缓存判断，再实时拉一次兜底（避免本地缓存过期导致误放行/误拦截）
      let latestBalance = tokenBalance;
      try {
        latestBalance = await fetchTokenBalance();
      } catch {}
      if (amountVal > latestBalance) {
        newErrors.amount =
          t.common?.insufficientShares || "Insufficient shares";
      }
    }

    if (orderType === "limit") {
      const limitVal = parseFloat(limitPrice);
      if (!limitPrice || isNaN(limitVal) || limitVal < 0.1 || limitVal > 99.9) {
        newErrors.limitPrice =
          t.trade.errorInvalidPrice ||
          "Enter a valid price between 0.1 and 99.9¢";
      }
      // 限价单 CTF 数量必须 >= 5
      if (amountVal < 5) {
        newErrors.amount =
          t.trade?.errorLimitMinShares ||
          "Limit order requires at least 5 shares";
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      if (newErrors.amount) toast.error(newErrors.amount);
      return;
    }

    if (!market || !selectOutcomeId) return;

    hapticImpact('Medium');
    setIsSubmitting(true);
    try {
      // ─── 预先生成 clientId（uint32 随机数），全流程共用同一个 ─────────────────
      // - 传给 createOrderNew API（后端绑定订单追踪）
      // - 传给 dYdX 链上 buy/sell（保证两端 clientId 一致）
      // 时间戳低 16 位（ms，约每 65s 循环）| 随机 16 位 → uint32
      // 同一毫秒内再碰撞概率 1/65536，跨毫秒更低
      const clientId =
        (((Date.now() & 0xffff) << 16) | Math.floor(Math.random() * 65536)) >>>
        0;

      const selectedItem = items.find((i) => i.value === selectOutcomeId);
      const tokenType = (selectedItem?.type || "YES") as "YES" | "NO";

      // Calculate correct price for Limit orders (cents -> dollars)
      const priceParam =
        orderType === "limit"
          ? (parseFloat(limitPrice) / 100).toString()
          : undefined;

      const duration =
        orderType === "limit"
          ? expirationEnabled
            ? parseExpiration(expirationTime, market.endDate)
            : 300 // 默认 5 分钟（300s）
          : undefined;
      const orderExecType: "LIMIT" | "MARKET" =
        orderType === "limit" ? "LIMIT" : "MARKET";

      // Calculate the amount to submit to buy/sell API:
      // - LIMIT: user 'amount' is already shares -> submit directly
      // - MARKET: user 'amount' is USDT (total). convert to shares by consuming orderbook (逐层吃单)，回退到 selectedPrice
      let submitAmount = amount; // string
      if (orderType === "market") {
        const usd = parseFloat(amount || "0");
        let computedShares = 0;

        // 中文注释：
        // 1. 确定当前选中的 token 类型 (YES 或 NO)
        const selectedItem = items.find((i) => i.value === selectOutcomeId);
        const isYes = selectedItem?.type === "YES";

        // 2. 选择对应的 Orderbook (YesOrderbook 或 NoOrderbook)
        const ob = isYes ? yesOrderbook : noOrderbook;

        console.log("ob", selectedItem, yesOrderbook, ob);

        // 要求：市价单必须依赖实时订单簿（对应方向）才能下单
        // - BUY 需有 asks
        // - SELL 需有 bids
        const hasObData =
          !!ob &&
          ((direction === "BUY" && (ob.asks || []).length > 0) ||
            (direction === "SELL" && (ob.bids || []).length > 0));
        if (!hasObData) {
          const msg =
            t.market?.noOrderbookData || "No orderbook data for selected side";
          setErrors((prev) => ({ ...prev, amount: msg }));
          toast.error(msg);
          return;
        }

        if (ob) {
          let remaining = usd;
          let totalShares = 0;

          if (direction === "BUY") {
            const asks = (ob.asks || []).slice().reverse(); // low->high
            for (const lvl of asks) {
              if (remaining <= 0) break;
              const p = lvl.price;
              const s = lvl.size;
              const cost = p * s;
              if (remaining >= cost) {
                totalShares += s;
                remaining -= cost;
              } else {
                totalShares += remaining / p;
                remaining = 0;
                break;
              }
            }
          } else {
            const bids = ob.bids || []; // high->low
            for (const lvl of bids) {
              if (remaining <= 0) break;
              const p = lvl.price;
              const s = lvl.size;
              const proceeds = p * s;
              if (remaining >= proceeds) {
                totalShares += s;
                remaining -= proceeds;
              } else {
                totalShares += remaining / p;
                remaining = 0;
                break;
              }
            }
          }

          computedShares = totalShares;
        }

        // 如果计算得到的 shares 为 0（例如用户输入过小或订单簿深度为 0），阻止下单
        if (!computedShares || computedShares <= 0) {
          const msg =
            t.trade.errorInvalidAmount || "Calculated order size is zero";
          setErrors((prev) => ({ ...prev, amount: msg }));
          toast.error(msg);
          return;
        }

        // format to 6 decimal places (dYdX expects 6-decimal quantums)
        submitAmount = computedShares > 0 ? computedShares.toFixed(6) : "0";
      }

      // ─── To-B 单步下单（替换原 createOrderNew → bridge → dYdX SDK 三步）──
      // 后端负责拆单、跨链、链上撮合；前端只需拿到 betId/routerOrderId 并展示结果。
      const eventId: string = (market as any).eventId;

      // 买单：amount = USDT 值；卖单：amount=0, size = shares
      // - 限价买单：用户输入 shares，USDT = shares × (limitPrice / 100)
      // - 市价买单：用户直接输入 USDT
      const amountNum =
        orderType === "limit"
          ? parseFloat(
              (
                parseFloat(amount || "0") *
                (parseFloat(limitPrice || "0") / 100)
              ).toFixed(6)
            )
          : parseFloat(parseFloat(amount || "0").toFixed(2));
      const sizeNum =
        direction === "SELL"
          ? parseFloat(amount || "0")
          : parseFloat(submitAmount || "0");

      const orderPrice = priceParam ? parseFloat(priceParam) : undefined;

      // MARKET=0, LIMIT+GTT=64, LIMIT 无过期=0
      const orderFlags: number =
        orderType === "limit" && duration !== undefined ? 64 : 0;

      const clobPairId: string | undefined = (
        market as any
      ).marketOutcomes?.find(
        (item: any) => item.tokenId === selectOutcomeId
      )?.clobPairId;

      // 幂等 betId：每次提交生成新 uuid（同一单重复点击会被后端拒）
      const betId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? (crypto as any).randomUUID()
          : `bet-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const tobPayload = {
        betId,
        clientId,
        eventId: String(eventId ?? ""),
        tokenId: String(selectOutcomeId ?? ""),
        side: direction as "BUY" | "SELL",
        amount: String(amountNum),
        size: String(sizeNum),
        orderType: orderType === "limit" ? "LIMIT" : "MARKET",
        orderPrice: orderPrice !== undefined ? String(orderPrice) : undefined,
        expiryTime: duration !== undefined ? String(duration) : "0",
        orderFlags,
        clobPairId: clobPairId ? String(clobPairId) : "",
      };
      console.log("[TradingPanel] tobApi.createOrder payload:", tobPayload);

      try {
        const tobResp = await tobApi.createOrder(tobPayload);
        console.log("[TradingPanel] tobApi.createOrder response:", tobResp);

        trackEvent("order_place", {
          market_id: (market as any)?.id,
          size: sizeNum,
          price: orderPrice ?? selectedPrice ?? 0,
          order_type: orderType,
          side: direction === "BUY" ? "buy" : "sell",
          bet_id: tobResp.betId,
          router_order_id: tobResp.routerOrderId,
        });
        hapticNotification("Success");
        // 成功固定用本地化文案；后端 message 字段是序列化的 tx 详情对象，不适合给用户看
        toast.success(t.common?.tradeSuccess || "Trade submitted successfully");
        return;
      } catch (apiErr: any) {
        throw apiErr;
      }
    } catch (e: any) {
      console.error("Trade failed", e);
      // token 失效（HTTP 401）：axios 层已重放过一次仍失败（典型是父页 15s 内没回新
      // token）。这里记录意图 + 再请一次续期；新 token 到达后由 auto-resume effect 补发，
      // 不给用户报错，做到无感续单
      if (e?.response?.status === 401) {
        pendingTradeAtRef.current = Date.now();
        setResumingAfterAuth(true);
        requestAuthRefresh("expired");
        toast.info(
          t.common?.orderResumeAfterLogin ??
            "Session expired — your order will be placed automatically after re-login"
        );
        return;
      }
      hapticNotification('Error');
      // 优先展示后端返回的业务错误信息（如 SELF_TRADE_PREVENTION 的详细 message）
      const backendMsg = e?.response?.data?.message;
      toast.error(backendMsg || e.message || t.common?.tradeFailed || "Trade failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  // 每次渲染镜像最新的 handler，供 auto-resume effect 调用
  handleTradingClickRef.current = handleTradingClick;

  // auto-resume：新 token 到达（embedToken 变化）或重新登录（authenticated 变 true）后，
  // 若存在「待执行下单意图」且仍在有效期内，自动补发那一单。
  // - 未登录场景：authenticated false→true 触发
  // - token 失效场景：authenticated 始终为 true，靠 embedToken 变化触发
  useEffect(() => {
    const at = pendingTradeAtRef.current;
    if (at == null) return;
    if (!authenticated || !embedToken) return;
    // 消费意图（先清，避免重复触发 / 循环）
    pendingTradeAtRef.current = null;
    setResumingAfterAuth(false);
    if (Date.now() - at <= PENDING_TRADE_TTL_MS) {
      void handleTradingClickRef.current?.();
    }
     
  }, [authenticated, embedToken]);

  // 兜底：父页迟迟不下发新 token 时，超过有效期清掉等待态，避免按钮一直卡在「等待登录」
  useEffect(() => {
    if (!resumingAfterAuth) return;
    const timer = setTimeout(() => {
      pendingTradeAtRef.current = null;
      setResumingAfterAuth(false);
    }, PENDING_TRADE_TTL_MS);
    return () => clearTimeout(timer);
  }, [resumingAfterAuth]);

  return (
    <div className="font-semibold relative p-4">
      {/* Header */}
      {!hideHeader && (
        <div className="mb-4">
          <div className="flex items-center gap-3">
            {(market?.icon || event?.icon || event?.image) && (
              /**
               * 中文注释：
               * - 交易面板出现频率很高（列表点进去都会看到），图标不显示会很影响体验
               * - 这里使用 ProxyImage：
               *   1) 优先走 /i?url=...（Cloudflare 边缘缓存加速）
               *   2) 代理失败则自动回退直连第三方
               *   3) 加载失败时通过 hideOnError 隐藏破图占位
               */
              <ProxyImage
                src={(market?.icon || event?.icon || event?.image) as string}
                alt=""
                className="size-10 rounded-[var(--radius-md)] object-cover"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm line-clamp-2">
                {market?.groupItemTitle || market?.question}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Buy/Sell Tabs */}
      <Tabs
        items={[
          { label: t.trade.buy, value: "buy" },
          { label: t.trade.sell, value: "sell" },
        ]}
        size="small"
        value={direction.toLowerCase()}
        onChange={(value) =>
          setDirection(value.toUpperCase() as "BUY" | "SELL")
        }
        className="mb-6 -ml-4 -mr-4"
        rightSlot={
          <Popover
            trigger="hover"
            placement="bottom"
            content={({ close: closePopover }) => (
              <div className="min-w-[120px] font-medium">
                <button
                  onClick={() => {
                    closePopover();
                    setOrderType("market");
                    setOrderTypePopoverOpen(false);
                  }}
                  className={`w-full p-3 rounded-sm text-left transition-(--transition-fast) text-(--text-primary) bg-transparent hover:bg-(--bg-hover)`}
                >
                  {t.trade.market}
                </button>
                <button
                  onClick={() => {
                    closePopover();
                    setOrderType("limit");
                    setOrderTypePopoverOpen(false);
                  }}
                  className={`w-full p-3 rounded-sm text-left transition-(--transition-fast) bg-transparent hover:bg-(--bg-hover)`}
                >
                  {t.trade.limit}
                </button>
                <div className="border-t border-(--border)"></div>
                <Popover
                  trigger="hover"
                  placement="right-top"
                  content={({ close }) => (
                    <div className="min-w-[120px] font-medium">
                      <button
                        onClick={() => {
                          closePopover();
                          close();
                          if (!authenticated) {
                            openLoginModalWithTrack({
                              login,
                              triggerAction: "merge_click",
                            });
                            return;
                          }
                          setMergeSharesDialogOpen(true);
                        }}
                        className={`w-full p-3 rounded-sm text-left transition-(--transition-fast) text-(--text-primary) bg-transparent hover:bg-(--bg-hover)`}
                      >
                        {t.trade.merge}
                      </button>
                      <button
                        onClick={() => {
                          closePopover();
                          close();
                          if (!authenticated) {
                            openLoginModalWithTrack({
                              login,
                              triggerAction: "split_click",
                            });
                            return;
                          }
                          setSplitSharesDialogOpen(true);
                        }}
                        className={`w-full p-3 rounded-sm text-left transition-(--transition-fast) bg-transparent hover:bg-(--bg-hover)`}
                      >
                        {t.trade.split}
                      </button>
                    </div>
                  )}
                >
                  <button className="w-full p-3 rounded-sm text-left transition-(--transition-fast) bg-transparent hover:bg-[color-mix(in_srgb,var(--bg-hover)_30%,transparent)] flex items-center justify-between">
                    <div>{t.trade.more}</div>
                    <ChevronRight />
                  </button>
                </Popover>
              </div>
            )}
          >
            <button className="px-3 py-2 cursor-pointer flex items-center gap-1">
              {orderType === "market" ? t.trade.market : t.trade.limit}
              <ChevronDown
                size={16}
                className={orderTypePopoverOpen ? "rotate-180" : "rotate-0"}
              />
            </button>
          </Popover>
        }
      />

      {/* Team Selection */}
      <ButtonGroup
        items={items}
        value={selectOutcomeId}
        onSelect={handleTokenSelect}
        error={!!errors.outcome}
        direction={direction}
      />

      {/* Limit Price (only for limit orders) */}
      {orderType === "limit" && (
        <LimitPriceInput
          value={limitPrice}
          onChange={(v) => {
            isManualEditRef.current = true; // 标记为用户手动修改
            setLimitPrice(v);
            setErrors((e) => ({ ...e, limitPrice: undefined }));
          }}
          error={!!errors.limitPrice}
        />
      )}

      {/* Amount Input */}
      <PriceInput
        tradeType={direction.toLowerCase() as TradeType}
        orderType={orderType}
        amount={amount}
        setAmount={(v) => {
          setAmount(v);
          setErrors((e) => ({ ...e, amount: undefined }));
        }}
        error={!!errors.amount}
        tokenBalance={tokenBalance}
        limitPrice={limitPrice}
        getLatestTokenBalance={fetchTokenBalance}
      />

      {orderType === "limit" && (
        <div className="flex flex-col gap-2 mt-4">
          <div className="h-[1px] bg-[var(--border)] mb-2"></div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-secondary)] font-medium">
              {t.trade.setExpiration}
            </span>
            <Switch
              className="scale-125 mr-1"
              checked={expirationEnabled}
              onCheckedChange={setExpirationEnabled}
            />
          </div>
          {expirationEnabled && (
            <div className="relative">
              <Popover
                open={expirationPopoverOpen}
                onOpenChange={setExpirationPopoverOpen}
                trigger="click"
                placement="bottom-left"
                matchWidth={true}
                offset={4}
                className="w-full"
                content={
                  <div className="flex flex-col">
                    {["5m", "1h", "12h", "24h", "End of day"].map((time) => (
                      <button
                        key={time}
                        className="p-3 text-left hover:bg-[var(--bg-hover)] transition-colors rounded-sm"
                        onClick={() => {
                          setExpirationTime(time);
                          setExpirationPopoverOpen(false);
                        }}
                      >
                        {(t.trade as any)[`time_${time}`] || time}
                      </button>
                    ))}
                  </div>
                }
              >
                <div className="w-full flex items-center justify-between cursor-pointer p-3 border border-(--border) rounded-md hover:border-(--text-secondary) transition-colors">
                  <span>
                    {(t.trade as any)[`time_${expirationTime}`] ||
                      expirationTime}
                  </span>
                  <ChevronDown
                    size={16}
                    className="text-[var(--text-secondary)]"
                  />
                </div>
              </Popover>
            </div>
          )}
        </div>
      )}

      {/* Dynamic Summary Section */}
      <div className="mt-4 space-y-3">
        {orderType === "limit" ? (
          <>
            {/* Limit Order Summary */}
            <div className="flex justify-between items-center text-base">
              <span className="font-medium text-[var(--text-secondary)]">
                {direction === "BUY" ? t.trade.total : t.trade.youWillReceive}
              </span>
              <span className="text-[var(--accent)] font-bold text-xl border-b border-dotted border-[var(--accent)] cursor-help">
                $
                {(
                  parseFloat(amount || "0") *
                    (parseFloat(limitPrice || "0") / 100) || 0
                ).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>

            <div className="flex justify-between items-center text-base">
              <div className="flex items-center gap-1.5 font-medium text-[var(--text-secondary)]">
                {direction === "BUY" ? t.trade.toWin : t.trade.total}
                <Info size={14} className="text-[var(--text-tertiary)] ml-1" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500 font-bold text-xl flex items-center">
                  <BadgeDollarSign size={20} className="text-green-500 mr-1" />$
                  {(
                    parseFloat(amount || "0") *
                    (direction === "BUY"
                      ? 1
                      : parseFloat(limitPrice || "0") / 100)
                  ).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </>
        ) : /* Market Order Summary */
        amount && parseFloat(amount) > 0 ? (
          <WinPreview
            amount={parseFloat(amount)}
            price={selectedPrice}
            isSell={direction === "SELL"}
            {...(() => {
              const input = parseFloat(amount || "0");
              if (!input || input <= 0) return { avgPrice: 0 };
              const ob = direction === "BUY" ? yesOrderbook : noOrderbook;

              // fallback: use simple estimate (amount / selectedPrice)
              if (!ob) {
                return { avgPrice: selectedPrice || 0 };
              }

              let remaining = input; // USDT to spend / receive
              let totalShares = 0;
              let totalCost = 0;

              if (direction === "BUY") {
                const asks = (ob.asks || []).slice().reverse(); // low->high
                for (const lvl of asks) {
                  if (remaining <= 0) break;
                  const p = lvl.price;
                  const s = lvl.size;
                  const cost = p * s;
                  if (remaining >= cost) {
                    totalShares += s;
                    totalCost += cost;
                    remaining -= cost;
                  } else {
                    const partial = remaining / p;
                    totalShares += partial;
                    totalCost += partial * p;
                    remaining = 0;
                    break;
                  }
                }
              } else {
                const bids = ob.bids || [];
                for (const lvl of bids) {
                  if (remaining <= 0) break;
                  const p = lvl.price;
                  const s = lvl.size;
                  const proceeds = p * s;
                  if (remaining >= proceeds) {
                    totalShares += s;
                    totalCost += proceeds;
                    remaining -= proceeds;
                  } else {
                    const partial = remaining / p;
                    totalShares += partial;
                    totalCost += partial * p;
                    remaining = 0;
                    break;
                  }
                }
              }

              const avg =
                totalShares > 0 ? totalCost / totalShares : selectedPrice || 0;
              return { avgPrice: avg };
            })()}
          />
        ) : null}
      </div>

      {
        amount &&
          parseFloat(amount) > 0 &&
          orderType === "market" &&
          false /* Hidden original preview */
      }

      {/* Trade Button */}
      <GameButton
        color="var(--blue)"
        size="lg"
        className="w-full mt-8"
        onClick={handleTradingClick}
        disabled={isSubmitting || isTrading || resumingAfterAuth}
      >
        {isSubmitting || isTrading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" size={20} />
            <span>{t.trade.processing}</span>
          </div>
        ) : resumingAfterAuth ? (
          // 等待父页下发新 token，到达后自动续单
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" size={20} />
            <span>
              {t.common?.waitingForLogin ?? "Waiting for login…"}
            </span>
          </div>
        ) : !authenticated ? (
          t.common?.pleaseLoginInParent ?? "Please log in via the host page"
        ) : (
          t.trade.trade
        )}
      </GameButton>

      {/* Message feedback can be added here if needed */}

      <MergeShares
        open={mergeSharesDialogOpen}
        onOpenChange={setMergeSharesDialogOpen}
        onSuccess={() => {
          /* embed 不维护余额状态；split/merge 成功无需刷新本地 */
        }}
      />
      <SplitShares
        open={splitSharesDialogOpen}
        onOpenChange={setSplitSharesDialogOpen}
        onConfirm={() => {}}
        onSuccess={() => {
          /* embed 不维护余额状态 */
        }}
        conditionId={market?.conditionId || ""}
        marketId={market?.id ? String(market.id) : ""}
        yesLabel={yesLabel}
        noLabel={noLabel}
        marketOutcomes={sortedOutcomes as any[]}
      />
    </div>
  );
}

interface TeamInfo {
  name: string;
  price: number;
  /** API 静态价格，用于按钮标签显示（与 games 列表一致） */
  labelPrice: number;
  buyPrice?: number;
  sellPrice?: number;
  color: string;
  value: string;
  type: string;
}

function ButtonGroup({
  items,
  value,
  onSelect,
  error,
  direction,
}: {
  items: TeamInfo[] & { buyPrice?: number; sellPrice?: number }[];
  value?: string | null;
  onSelect?: (value: string) => void;
  error?: boolean;
  direction: "BUY" | "SELL";
}) {
  return (
    <div
      className={`flex gap-[var(--spacing-md)] mb-[var(--spacing-lg)] p-1 rounded-md transition-colors ${
        error ? "bg-red-500/10 border border-red-500/20" : ""
      }`}
    >
      {items.map((item) => {
        const isSelected = value === item.value;
        const displayPrice =
          direction === "BUY"
            ? item.buyPrice ?? item.price
            : item.sellPrice ?? item.price;
        return (
          <GameButton
            key={item.type}
            color={isSelected ? item.color : "var(--bg-secondary)"}
            className={`flex-1 min-w-0 ${
              isSelected ? "" : "!text-(--text-secondary)"
            }`}
            onClick={() => onSelect?.(item.value)}
          >
            <span className="truncate">{item.name}</span>
            <span className="flex-shrink-0 ml-1">
              {(item.labelPrice * 100).toFixed(1)}¢
            </span>
          </GameButton>
        );
      })}
    </div>
  );
}

function PriceInput({
  tradeType,
  orderType,
  amount,
  setAmount,
  error,
  tokenBalance = 0,
  limitPrice = "",
  getLatestTokenBalance,
}: {
  tradeType: TradeType;
  orderType: OrderType;
  amount: string;
  setAmount: (val: string) => void;
  error?: boolean;
  /** CTF 持仓（shares 数，已是 number），SELL 侧 MAX/百分比按钮依赖这个 */
  tokenBalance?: number;
  /** 限价单价格（¢），SELL 侧不会用到但 buy limit 也用不上 */
  limitPrice?: string;
  /** 实时拉取最新 CTF 持仓的回调（点击 MAX/百分比时兜底拉一次） */
  getLatestTokenBalance?: () => Promise<number>;
}) {
  const { t } = useTranslation();
  const isShares = orderType === "limit" || tradeType === "sell"; // Limit order or Sell order always uses "Shares"

  const handleQuickAdd = (add: number) => {
    const current = parseFloat(amount || "0");
    setAmount((current + add).toString());
  };

  const handleSellMax = async () => {
    let latest = tokenBalance;
    if (getLatestTokenBalance) {
      try {
        latest = await getLatestTokenBalance();
      } catch {}
    }
    setAmount(latest > 0 ? latest.toFixed(2).replace(/\.?0+$/g, "") : "0");
  };

  const handleSellPercent = async (percent: number) => {
    let latest = tokenBalance;
    if (getLatestTokenBalance) {
      try {
        latest = await getLatestTokenBalance();
      } catch {}
    }
    const v = latest * percent;
    setAmount(v > 0 ? v.toFixed(2).replace(/\.?0+$/g, "") : "0");
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <div
        className={`flex gap-3 border-b-2 transition-colors ${
          error
            ? "border-red-500"
            : "border-transparent focus-within:border-[var(--accent)] hover:border-[var(--border)]"
        }`}
      >
        <div className="py-2 opacity-70 flex items-center">
          {isShares ? t.trade.shares : t.trade.amount}
        </div>
        <div className="flex-1">
          <input
            value={amount ? (isShares ? amount : `$${amount}`) : ""}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                setAmount("");
                return;
              }

              // strip everything except digits and dot
              let val = raw.replace(/[^0-9.]/g, "");

              // collapse multiple dots into the first
              const parts = val.split(".");
              if (parts.length > 2) {
                val = parts[0] + "." + parts.slice(1).join("");
              }

              // ensure leading zero for ".xx" inputs
              if (val.startsWith(".")) val = "0" + val;

              if (val.includes(".")) {
                const [intPart, decPart] = val.split(".");
                const intClean = intPart.replace(/^0+(?=\d)/, "");
                const decClean = (decPart || "").slice(0, 2); // 限制最多 2 位小数
                val = (intClean === "" ? "0" : intClean) + "." + decClean;
              } else {
                // remove leading zeros but keep single 0
                val = val.replace(/^0+(?=\d)/, "");
              }

              setAmount(val);
            }}
            onBlur={() => {
              if (!amount) return;
              let v = amount;
              // remove trailing dot
              if (v.endsWith(".")) v = v.slice(0, -1);
              if (v === "") {
                setAmount("");
                return;
              }

              // sanitize and keep up to 2 decimals
              let cleaned = v.replace(/[^0-9.]/g, "");
              const parts = cleaned.split(".");
              if (parts.length > 2)
                cleaned = parts[0] + "." + parts.slice(1).join("");

              if (cleaned.includes(".")) {
                const [intPart, decPart] = cleaned.split(".");
                const intClean = intPart.replace(/^0+(?=\d)/, "");
                const decClean = (decPart || "").slice(0, 2);
                cleaned = (intClean === "" ? "0" : intClean) + "." + decClean;
              } else {
                cleaned = cleaned.replace(/^0+(?=\d)/, "");
              }

              const n = parseFloat(cleaned || "0");
              if (isNaN(n)) {
                setAmount("");
                return;
              }

              // format to up to 2 decimals WITHOUT unnecessary trailing zeros (e.g. 1.00 -> 1, 1.20 -> 1.2)
              const normalized = n.toFixed(2).replace(/\.?0+$/g, "");
              if (normalized !== amount) setAmount(normalized);
            }}
            className="bg-transparent text-right w-full flex-1 h-16 text-[40px] outline-none placeholder:text-[var(--text-tertiary)]"
            placeholder={isShares ? "0" : "$0"}
          />
        </div>
      </div>

      {/* 快捷按钮：BUY 用 +1/+20/+100（不读 USDT 余额，因父页面控制），
          SELL 用 25%/50%/MAX（依赖本地 CTF 持仓 + 点击时实时拉取兜底） */}
      {tradeType === "buy" ? (
        <div className="flex justify-end gap-1 text-xs">
          {[1, 20, 100].map((val) => (
            <div
              key={val}
              onClick={() => handleQuickAdd(val)}
              className="border select-none rounded-sm px-2 py-1 cursor-pointer border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              +{val}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex justify-end gap-1 text-xs">
          <div
            onClick={() => void handleSellPercent(0.25)}
            className="border select-none rounded-sm px-2 py-1 cursor-pointer border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            {t.trade.percent25}
          </div>
          <div
            onClick={() => void handleSellPercent(0.5)}
            className="border select-none rounded-sm px-2 py-1 cursor-pointer border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            {t.trade.percent50}
          </div>
          <div
            onClick={() => void handleSellMax()}
            className="border select-none rounded-sm px-2 py-1 cursor-pointer border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            {t.trade.max}
          </div>
        </div>
      )}
    </div>
  );
}

function WinPreview({
  amount,
  price,
  isSell = false,
  avgPrice = 0,
}: {
  amount: number;
  price: number;
  isSell?: boolean;
  avgPrice?: number;
}) {
  const { t } = useTranslation();
  // Simplified logic
  // Sell Market: Input is Shares. Win = Shares * Price.

  const winAmount = price > 0 ? (isSell ? amount * price : amount / price) : 0;

  const avgCents = avgPrice > 0 ? (avgPrice * 100).toFixed(1) + "¢" : "—";

  // 动态缩放右侧可赢金额字体，避免挤压左侧文字
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const [fontSize, setFontSize] = useState<number>(40); // px, 初始接近 text-4xl

  useEffect(() => {
    const container = containerRef.current;
    const right = rightRef.current;
    if (!container || !right) return;

    const compute = () => {
      const leftEl = container.querySelector(
        ".left-content"
      ) as HTMLElement | null;
      const gap = 16; // 预留间隙
      const containerWidth = container.clientWidth;
      const leftWidth = leftEl ? leftEl.offsetWidth : 0;
      const remainingSpace = Math.max(0, containerWidth - leftWidth - gap);
      const maxRightWidth = Math.floor(containerWidth * 0.5); // 限制右侧最大占比 50%
      const available = Math.min(remainingSpace, maxRightWidth);

      const txt =
        winAmount > 0
          ? `$${winAmount.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}`
          : "";
      const DEFAULT_FONT = 40;
      const MIN_FONT = 18;
      const MAX_FONT = 48;

      if (!txt || available <= 0) {
        setFontSize(DEFAULT_FONT);
        return;
      }

      // 使用 canvas 精确测量在默认字号下的文本宽度；仅当宽度超出可用空间时才按比例缩放
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setFontSize(DEFAULT_FONT);
        return;
      }
      // 使用常见 UI 字体族进行测量，接近真实渲染
      ctx.font = `${DEFAULT_FONT}px -apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,\"Helvetica Neue\",Arial`;
      const textWidth = Math.ceil(ctx.measureText(txt).width);

      if (textWidth <= available) {
        setFontSize(DEFAULT_FONT);
        return;
      }

      const scale = available / textWidth;
      const estimated = Math.max(
        MIN_FONT,
        Math.min(MAX_FONT, Math.floor(DEFAULT_FONT * scale))
      );
      setFontSize(estimated);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [winAmount]);

  return (
    <div className="mt-0">
      <div className="flex items-center justify-between" ref={containerRef}>
        <div className="left-content">
          <div className="flex items-center gap-2 font-medium text-lg text-[var(--text-secondary)]">
            <span>{isSell ? t.trade.youWillReceive : t.trade.toWin}</span>
            <BadgeDollarSign size={20} className="text-green-500" />
          </div>
          <div className="flex items-center gap-3 text-[var(--text-secondary)] mt-1">
            <span className="text-xs">
              {t.trade.avgPrice} {avgCents}
            </span>
            {/* <Popover
              placement="top"
              trigger="hover"
              content={
                <div className="p-3 flex flex-col gap-2 min-w-40">
                   <div className="text-xs opacity-50">Detailed breakdown...</div>
                </div>
              }
            >
              <Info size={12} />
            </Popover> */}
          </div>
        </div>
        <div
          ref={rightRef}
          className="text-green-500 font-bold"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: 1,
            width: "50%",
            whiteSpace: "nowrap",
            overflow: "visible",
            textAlign: "right",
          }}
        >
          {winAmount > 0
            ? `$${winAmount.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}`
            : ""}
        </div>
      </div>
    </div>
  );
}

function LimitPriceInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="w-full flex flex-col gap-2 mb-4">
      <div
        className={`flex gap-3 items-center border-b-2 transition-colors ${
          error
            ? "border-red-500"
            : "border-transparent focus-within:border-[var(--accent)] hover:border-[var(--border)]"
        }`}
      >
        <div className="opacity-70">{t.trade.limitPrice}</div>
        <div className="flex-1 relative flex items-center">
          <input
            value={value}
            onChange={(e) => {
              const raw = e.target.value;
              // allow empty (user clearing input)
              if (raw === "") {
                onChange("");
                return;
              }

              // keep only digits and dot, allow a single dot
              let val = raw.replace(/[^0-9.]/g, "");
              const parts = val.split(".");
              if (parts.length > 2) {
                val = parts[0] + "." + parts.slice(1).join("");
              }

              if (val.includes(".")) {
                // integer part: remove leading zeros but keep single 0
                const [intPart, decPart] = val.split(".");
                const intClean = intPart.replace(/^0+(?=\d)/, "");
                const decClean = (decPart || "").slice(0, 1); // 支持 1 位小数
                val = (intClean === "" ? "0" : intClean) + "." + decClean;
              } else {
                // no decimal point: remove leading zeros (keep single 0) and limit integer length to 2 (max 99)
                val = val.replace(/^0+(?=\d)/, "");
                if (val.length > 2) val = val.slice(0, 2);
              }

              // 当用户输入的是完整数值（不是以 '.' 结尾），执行范围限制：0.1 - 99.9
              if (val !== "" && !val.endsWith(".")) {
                const n = parseFloat(val);
                if (!isNaN(n)) {
                  const clipped = Math.max(0.1, Math.min(99.9, n));
                  val = Number.isInteger(clipped)
                    ? clipped.toString()
                    : clipped.toFixed(1);
                }
              }

              onChange(val);
            }}
            onBlur={() => {
              if (!value) return;
              let v = value;
              // if user left a trailing dot (e.g. '1.'), remove it and normalize
              if (v.endsWith(".")) v = v.slice(0, -1);
              if (v === "") {
                onChange("");
                return;
              }

              // sanitize and ensure single-dot format
              let cleaned = v.replace(/[^0-9.]/g, "");
              const parts = cleaned.split(".");
              if (parts.length > 2)
                cleaned = parts[0] + "." + parts.slice(1).join("");

              if (cleaned.includes(".")) {
                const [intPart, decPart] = cleaned.split(".");
                const intClean = intPart.replace(/^0+(?=\d)/, "");
                const decClean = (decPart || "").slice(0, 1);
                cleaned = (intClean === "" ? "0" : intClean) + "." + decClean;
              } else {
                cleaned = cleaned.replace(/^0+(?=\d)/, "");
              }

              // clamp to allowed numeric range
              const num = parseFloat(cleaned || "0");
              if (isNaN(num)) {
                onChange("");
                return;
              }
              const clipped = Math.max(0.1, Math.min(99.9, num));
              const normalized = Number.isInteger(clipped)
                ? clipped.toString()
                : clipped.toFixed(1);
              if (normalized !== value) onChange(normalized);
            }}
            className="bg-transparent flex-1 w-full h-10 text-[24px] text-right outline-none placeholder:text-[var(--text-tertiary)] pr-5"
            placeholder="0"
          />
          <span
            className={`absolute right-0 text-[24px] pointer-events-none ${
              !value ? "text-[var(--text-tertiary)]" : ""
            }`}
          >
            ¢
          </span>
        </div>
      </div>
    </div>
  );
}
