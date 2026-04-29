import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Copy, ChevronDown, ChevronUp, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

import useSWR from "swr";
import { getUserOrders, getClaimingOrders } from "@/lib/api";
import { useI18n } from "@/components/hooks/useI18n";
import { formatHandicap } from "@/utils/handicap";
import {
  ApiOrderBookRecord,
  OrderBookType,
  OrderDetailType,
} from "../types";

import { useAuthStore } from "@/lib/stores/authStore";
import {
  getMatchStateByCode,
  isMatchEnded,
  MatchMark,
  MatchState,
} from "@/types/match-state";
import { useToast } from "@/components/ui/Toast";
import Select from "@/components/ui/Select";

interface OrderBookTabProps {
  isActive: boolean;
}

// 动态金额格式化：默认保留两位小数；如果数值小于 1 且两位小数为 0.00，则继续增加小数位数，直到出现非 0 数字（或达到上限）
const formatDynamicAmount = (value: string | number, maxDecimals: number = 8): string => {
  if (value === "-" || value === "" || value == null) return "-";

  const num = Number(value);
  if (Number.isNaN(num)) return String(value);

  const isNegative = num < 0;
  const absNum = Math.abs(num);

  // 完全等于 0 的情况，直接显示 "0"
  if (absNum === 0) return "0";

  // 大于等于 1：固定两位小数 + 千分位
  if (absNum >= 1) {
    return (isNegative ? -absNum : absNum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // 小于 1：从 2 位开始增加精度，直到不为 0
  let formatted = "0.00";
  for (let decimals = 2; decimals <= maxDecimals; decimals++) {
    const candidate = absNum.toFixed(decimals);
    if (Number(candidate) !== 0) {
      formatted = candidate;
      break;
    }
  }

  // 去掉多余的结尾 0，但至少保留两位小数
  const [intPart, fracPartRaw] = formatted.split(".");
  if (!fracPartRaw) return isNegative ? `-${formatted}` : formatted;

  let fracPart = fracPartRaw;
  while (fracPart.length > 2 && fracPart.endsWith("0")) {
    fracPart = fracPart.slice(0, -1);
  }

  const formattedInt = Number(intPart).toLocaleString();
  const result = `${formattedInt}.${fracPart}`;
  return isNegative ? `-${result}` : result;
};

const pageSizeOptions = [5, 10, 20, 50];

const OrderBookTab: React.FC<OrderBookTabProps> = ({ isActive }) => {
  // 统一使用市场详情页同款自定义 toast，避免 antd message 多套提示风格并存
  const toast = useToast();

  const { t } = useI18n();
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuthStore();

  // 添加订单簿相关状态
  const [orderBookData, setOrderBookData] = useState<OrderBookType[]>([]);
  const [orderBookLoading, setOrderBookLoading] = useState(false);
  const [orderBookPagination, setOrderBookPagination] = useState({
    current: 1,
    pageSize: 5,
    total: 0,
  });

  // 领取状态管理
  const [claimingStatus, setClaimingStatus] = useState<{
    [key: string]: string;
  }>({});

  // 手风琴展开状态（允许同时展开多个卡片）
  // 返回时自动恢复上次展开的订单
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("orderbook_expanded");
      if (saved) {
        sessionStorage.removeItem("orderbook_expanded");
        try {
          return new Set(JSON.parse(saved));
        } catch (e) {
          console.error('[OrderBookTab] Failed to parse expanded keys from sessionStorage', e);
        }
      }
    }
    return new Set();
  });

  // 返回后自动滚动到展开的订单
  useEffect(() => {
    if (expandedKeys.size > 0 && orderBookData.length > 0) {
      const firstKey = [...expandedKeys][0];
      const el = document.getElementById(`order-card-${firstKey}`);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderBookData.length > 0]);

  // 全局领取中的标记：防止同时发起多笔领取交易导致 nonce 冲突
  const [isClaimingTx, setIsClaimingTx] = useState(false);
  // 全部领取状态
  const [isClaimingAll, setIsClaimingAll] = useState(false);
  // 待领取数据（提前请求，控制按钮显隐 + 显示总额）
  const [claimingData, setClaimingData] = useState<{
    totalAmount: string;
    totalCount: number;
    records: Array<{ marketId: string; itemId: string }>;
  } | null>(null);

  // 待领取数据：SWR 自动轮询，tab 未激活或未登录时停止
  const claimingSwrKey = isAuthenticated && accessToken && isActive
    ? "user-claiming-orders"
    : null;

  const { data: claimingSwrData, mutate: mutateClaimingData } = useSWR(
    claimingSwrKey,
    async () => {
      const res = await getClaimingOrders();
      return res.success ? res.data : null;
    },
    { refreshInterval: 10000, dedupingInterval: 5000 }
  );

  // 同步到 state（兼容 handleClaimAll 使用）
  useEffect(() => {
    if (claimingSwrData) setClaimingData(claimingSwrData);
  }, [claimingSwrData]);

  // 使用SWR自动刷新订单数据
  // 只有在已认证且有 token 且 Tab 激活时才发起请求（传 null 作为 key 禁用请求）
  const swrKey = isAuthenticated && accessToken && isActive
    ? `user-orders-${orderBookPagination.current}-${orderBookPagination.pageSize}`
    : null;

  const {
    data: swrOrderData,
    error: swrOrderError,
    mutate,
  } = useSWR(
    swrKey,
    () =>
      getUserOrders(orderBookPagination.current, orderBookPagination.pageSize),
    { refreshInterval: 5000, dedupingInterval: 3000 }
  );

  // 转换订单簿 API 数据为组件所需格式
  const transformApiOrderBookData = (
    apiData: ApiOrderBookRecord[]
  ): OrderBookType[] => {
    return apiData.map((item, index) => {
      // 格式化时间戳 - 统一处理时间戳格式
      const formatTimestamp = (timestamp: string | number) => {
        try {
          const timestampNum =
            typeof timestamp === "string" ? parseInt(timestamp) : timestamp;
          // 判断时间戳格式：如果小于等于10位数字，说明是秒级；否则是毫秒级
          const date =
            timestampNum.toString().length <= 10
              ? new Date(timestampNum * 1000) // 秒级转毫秒级
              : new Date(timestampNum); // 毫秒级直接使用

          return date.toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
        } catch (e) {
          console.error('[OrderBookTab] Failed to format timestamp', e);
          return t("timeUnknown");
        }
      };

      // 根据 state 映射状态显示（优先使用 MatchState 枚举，与后端一致）
      const getMatchStatus = () => {
        const stateObj = getMatchStateByCode(item.state);
        if (stateObj) {
          if (stateObj.mark === MatchMark.END) {
            if (stateObj === MatchState.CANCELLED) return t("canceled");
            if (stateObj === MatchState.ABANDONED) return stateObj.label; // 腰斩
            return t("finished"); // FT 等
          }
          if (stateObj.mark === MatchMark.RUN) return t("inProgress");
          if (stateObj.mark === MatchMark.HOLD) return t("notStarted");
          if (stateObj.mark === MatchMark.DELAY) return stateObj.label; // 中断 / 推迟
        }

      };

      // 获取主队客队名称
      const getTeamNames = () => {
        if (!item.options || !Array.isArray(item.options)) {
          return {
            homeName: t("unknownHomeTeam"),
            awayName: t("unknownAwayTeam"),
          };
        }

        const homeTeam = item.options.find((option) => option.code === "1");
        const awayTeam = item.options.find((option) => option.code === "2");

        return {
          homeName: homeTeam?.name || t("unknownHomeTeam"),
          awayName: awayTeam?.name || t("unknownAwayTeam"),
        };
      };

      // 获取比赛结果，从 options 中的 outcomeValue 提取比分值（仅已结束赛事显示）
      const getMatchResult = (): string => {
        if (!isMatchEnded(item.state)) {
          return "- : -";
        }

        if (!item.options || !Array.isArray(item.options)) {
          return "- : -";
        }
        // 查找主队（code为"1"）和客队（code为"2"）的选项
        const homeTeam = item.options.find((option) => option.code === "1");
        const awayTeam = item.options.find((option) => option.code === "2");

        // 提取比分信息
        const homeScore = homeTeam?.outcomeValue || "-";
        const awayScore = awayTeam?.outcomeValue || "-";

        // 格式化为 "主队：客队" 格式
        return `${homeScore} : ${awayScore}`;
      };

      // 转换订单详情
      const transformOrderDetails = (): OrderDetailType[] => {
        if (!item.orderDetails || !Array.isArray(item.orderDetails)) {
          return [];
        }

        // 获取主队客队名称用于显示
        const { homeName, awayName } = getTeamNames();

        return item.orderDetails.map((detail, detailIndex) => {
          // 根据code确定投注的是主队还是客队
          const getSelectedTeam = () => {
            if (detail.code === "1") {
              return homeName; // 主队
            } else if (detail.code === "2") {
              return awayName; // 客队
            } else {
              return t("draw"); // 其他情况（如X代表平局）
            }
          };

          return {
            key: `order-${item.id}-${detail.txHash}-${detailIndex}`,
            handicap: detail.line || "-",
            homeTeamPool: getSelectedTeam(), // 显示具体的队伍名称
            awayTeamPool: "-", // 不再显示客队池，因为已经在homeTeamPool中显示了选择的队伍
            betAmount: `${(Number(detail.stakeAmount) || 0).toLocaleString()}`,
            // profitLoss: `${
            //   parseFloat(detail.claimableAmount) > 0 ? detail.profitLoss : "-"
            // }`,
            profitLoss: detail.profitLoss
              ? parseFloat(detail.profitLoss).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : "-",
            availableAmount:
              parseFloat(detail.claimableAmount) > 0
                ? formatDynamicAmount(detail.claimableAmount)
                : "-",
            createTime: formatTimestamp(detail.createdAt),
            transactionHash: detail.txHash || detail.transactionHash,
            marketId: detail.marketId || "",
            mechanism: detail.mechanism || "",
            claimStatus: detail.claimStatus,
            code: detail.code,
            option1Turnover: detail.option1Turnover || "0",
            option2Turnover: detail.option2Turnover || "0",
            ownSideStakeRatio: detail.ownSideStakeRatio || "0",
            anchorId: detail.anchorId || "",
          };
        });
      };

      const { homeName, awayName } = getTeamNames();

      return {
        key: item.id,
        serialNumber: (index + 1).toString().padStart(2, "0"),
        league: item.name || t("unknownLeague"), // 使用name字段作为联赛名称
        match: `${homeName} vs ${awayName}`, // 使用主队客队名称组成比赛名称
        matchTime: formatTimestamp(item.eventTime), // 使用eventTime字段
        handicapType: t("handicap"), // 根据orderDetails中的mechanism判断
        status: getMatchStatus(), // 存已翻译的状态文字，渲染直接展示
        result: getMatchResult(),
        // profitLoss: `${
        //   parseFloat(item.totalClaimableAmount) > 0 ? item.totalProfitLoss : "-"
        // }`,
        profitLoss: item.totalProfitLoss
          ? parseFloat(item.totalProfitLoss).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : "-",
        availableAmount:
          parseFloat(item.totalClaimableAmount) > 0
            ? formatDynamicAmount(item.totalClaimableAmount)
            : "-",
        totalStakeAmount: `${(Number(item.totalStakeAmount) || 0).toLocaleString()}`,
        isClaimable: item.isClaimable,
        operation:
          item.isClaimable && parseFloat(item.totalClaimableAmount) > 0
            ? t("claim")
            : "-",
        marketId: item.orderDetails?.[0]?.marketId || item.id, // 使用第一个订单详情的marketId，或回退到id
        eventId: item.orderDetails?.[0]?.eventId || "",
        anchorId: item.orderDetails?.[0]?.anchorId || "",
        option1Turnover: item.option1Turnover || "0",
        option2Turnover: item.option2Turnover || "0",
        ownSideStakeRatio: item.ownSideStakeRatio || "0",
        children: transformOrderDetails(),
      };
    });
  };

  // 处理SWR订单数据
  useEffect(() => {
    if (swrOrderData && swrOrderData.success && swrOrderData.data) {
      const apiData = swrOrderData.data as any;
      const transformedData = transformApiOrderBookData(
        (apiData.records as ApiOrderBookRecord[]) || []
      );

      // 简单的数据变化检查，避免完全冲突的重渲染
      setOrderBookData((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(transformedData))
          return prev;
        return transformedData;
      });

      setOrderBookPagination((prev) => {
        const nextTotal = apiData.total || 0;
        if (prev.total === nextTotal) return prev;
        return {
          ...prev,
          total: nextTotal,
        };
      });
    }
    if (swrOrderError) {
      console.error("SWR订单数据获取失败:", swrOrderError);
    }
  }, [swrOrderData, swrOrderError]);

  // 获取订单簿数据（手动刷新时使用）
  const fetchOrderBookData = async (page: number = 1, size: number = 5) => {
    if (!isAuthenticated || !accessToken) return;
    setOrderBookLoading(true);
    try {
      const response = await getUserOrders(page, size);
      if (response.success && response.data) {
        // Cast the response data to match the expected structure from the image
        const apiData = response.data as any;
        const transformedData = transformApiOrderBookData(
          (apiData.records as ApiOrderBookRecord[]) || []
        );
        setOrderBookData(transformedData);
        setOrderBookPagination({
          current: parseInt(String(apiData.current || apiData.page || page)),
          pageSize: parseInt(String(apiData.size || size)),
          total: parseInt(String(apiData.total || 0)),
        });
      } else {
        toast.error(
          (response as any).msg ||
          (response as any).message ||
          t("getOrderBookFailed")
        );
      }
    } catch (error) {
      console.error("获取订单簿失败:", error);
      toast.error(t("getOrderBookFailed"));
    } finally {
      setOrderBookLoading(false);
    }
  };

  // 当Tab激活时手动刷新一次
  useEffect(() => {
    if (isActive && isAuthenticated && accessToken) {
      mutate(); // 触发SWR重新验证
    }
  }, [isActive, isAuthenticated, accessToken, mutate]);

  // 处理订单簿分页变化
  const handleOrderBookPaginationChange = (page: number, pageSize?: number) => {
    fetchOrderBookData(page, pageSize || orderBookPagination.pageSize);
  };

  // ──────────────────────────── 工具函数 ────────────────────────────



  /** 获取赛事状态样式（只用文字颜色，不要背景色） */
  const getStatusStyle = (status: string) => {
    const notStartedLabel = t("notStarted");
    const inProgressLabel = t("inProgress");
    const finishedLabel = t("finished");
    const canceledLabel = t("canceled");
    switch (status) {
      case "created":
      case "1":
        return {
          border: "var(--border)",

        };
      case "waiting":
      case "2":
      case "3":
        return {
          border: "var(--border)",

        };
      case "completed":
      case "5":
        return {
          border: "var(--border)",

        };
      case "canceled":
      case "4":
        return {
          border: "var(--border)",

        };
      default:
        // 兼容已翻译文字作为 key 的情况，但颜色保持统一
        if (
          status === notStartedLabel ||
          status === inProgressLabel ||
          status === finishedLabel ||
          status === canceledLabel
        ) {
          return {
            border: "var(--border)",

          };
        }
        return {
          border: "var(--border)",

        };
    }
  };

  /** 盈亏颜色 */
  const getPnlColor = (text: string) => {
    if (text === "-") return "var(--text-secondary)";
    if (text === "0" || text === "0.00") return "var(--yellow)";
    return text.startsWith("-") ? "var(--red)" : "var(--green)";
  };

  /** 领取状态映射 */
  const getClaimStatusLabel = (code: number) => {
    switch (code) {
      case 0: return { label: "-" };
      case 1: return { label: t("notClaimed") };
      case 2: return { label: t("claimed") };
      case 3: return { label: t("claimableAmountZero") };
      default: return { label: t("unknownStatus") };
    }
  };

  // ──────────────────────────── 卡片渲染 ────────────────────────────

  const renderDetailRow = (detail: OrderDetailType) => {
    const cs = getClaimStatusLabel(detail.claimStatus);
    const isHomeTeam = detail.code === "1";
    const marketLine = Number(detail?.handicap);

    let lineDisplay = "-";
    if (detail.mechanism === "overUnder") {
      const formatted = formatHandicap(marketLine, false);
      lineDisplay = isHomeTeam ? `${t("over")}${formatted}` : `${t("under")}${formatted}`;
    } else if (detail.handicap !== "-") {
      const displayValue = isHomeTeam ? marketLine : -marketLine;
      lineDisplay = formatHandicap(displayValue, true);
    }

    // 投注选择：统一背景色（不区分主/客/平）
    const selBg = "";
    const selColor = "var(--text-primary)";

    const selLabel = detail.mechanism === "overUnder"
      ? lineDisplay
      : `${detail.homeTeamPool} ${lineDisplay}`;

    return (
      <div key={detail.key} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-x-4 gap-y-3 px-4 py-4 border-b border-dashed last:border-0"
        style={{ borderColor: "var(--border)" }}>
        {/* 盘口类型 + 详情 */}
        <div className="flex flex-col gap-1">
          <span className="text-[12px] lg:hidden" style={{ color: "var(--text-secondary)" }}>{t("handicapType")}</span>
          <div className="flex items-center gap-2">
            <span className="text-[14px]" style={{ color: "var(--text-primary)" }}>
              {detail.mechanism === "overUnder" ? t("overUnder") : t("handicap")}
            </span>
            {detail.marketId && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity"
                style={{ background: "var(--accent)", color: "var(--text-inverse)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  const anchorId = detail.anchorId || detail.marketId;
                  // 保存当前展开状态，返回时自动恢复
                  sessionStorage.setItem("orderbook_expanded", JSON.stringify([...expandedKeys]));
                  router.push(`/sports/football/asian/detail?eventId=${anchorId}&type=market&catalog=football&marketId=${detail.marketId}&from=orders`);
                }}
              >
                {t("detail") || "详情"}
              </span>
            )}
          </div>
        </div>
        {/* 投注选择 */}
        <div className="flex flex-col gap-1">
          <span className="text-[12px] lg:hidden" style={{ color: "var(--text-secondary)" }}>{t("betSelection")}</span>
          <span className="text-[12px] font-medium "
            style={{ background: selBg, color: selColor }}>
            {selLabel}
          </span>
        </div>
        {/* 下注金额 */}
        <div className="flex flex-col gap-1">
          <span className="text-[12px] lg:hidden" style={{ color: "var(--text-secondary)" }}>{t("betAmount")}</span>
          <span className="text-[14px] font-number" style={{ color: "var(--text-primary)" }}>{detail.betAmount}</span>
        </div>
        {/* 盈亏 */}
        <div className="flex flex-col gap-1">
          <span className="text-[12px] lg:hidden" style={{ color: "var(--text-secondary)" }}>{t("profitLoss")}</span>
          <span className="text-[14px] font-number font-semibold" style={{ color: getPnlColor(detail.profitLoss) }}>
            {detail.profitLoss}
          </span>
        </div>
        {/* 可领金额 */}
        <div className="flex flex-col gap-1">
          <span className="text-[12px] lg:hidden" style={{ color: "var(--text-secondary)" }}>{t("claimableAmount")}</span>
          <span className="text-[14px] font-number" style={{ color: "var(--text-primary)" }}>{detail.availableAmount}</span>
        </div>
        {/* 盘口总金额 */}
        <div className="flex flex-col gap-1">
          <span className="text-[12px] lg:hidden" style={{ color: "var(--text-secondary)" }}>{t("totalVolume") || "盘口总额"}</span>
          <span className="text-[14px] font-number" style={{ color: "var(--text-primary)" }}>
            {detail.option1Turnover && detail.option2Turnover
              ? `$${(parseFloat(detail.option1Turnover) + parseFloat(detail.option2Turnover)).toLocaleString()}`
              : "-"}
          </span>
        </div>
        {/* 我的占比 */}
        <div className="flex flex-col gap-1">
          <span className="text-[12px] lg:hidden" style={{ color: "var(--text-secondary)" }}>{t("myShare") || "我的占比"}</span>
          <span className="text-[14px] font-number" style={{ color: parseFloat(detail.ownSideStakeRatio || "0") > 0 ? "var(--accent)" : "var(--text-secondary)" }}>
            {(() => {
              const r = parseFloat(detail.ownSideStakeRatio || "0");
              if (r <= 0) return "-";
              return r >= 1 ? `${(r * 100).toFixed(0)}%` : `${(r * 100).toFixed(1)}%`;
            })()}
          </span>
        </div>
        {/* 交易哈希 */}
        <div className="flex flex-col gap-1">
          <span className="text-[12px] lg:hidden" style={{ color: "var(--text-secondary)" }}>{t("transactionHash")}</span>
          <div className="flex items-center gap-1">
            <span className="text-[12px] font-mono" style={{ color: "var(--info)" }} title={detail.transactionHash}>
              {detail.transactionHash
                ? `${detail.transactionHash.slice(0, 8)}…${detail.transactionHash.slice(-6)}`
                : t("none")}
            </span>
            {detail.transactionHash && (
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-primary"
                onClick={() => {
                  navigator.clipboard
                    .writeText(detail.transactionHash)
                    .then(() => toast.success(t("transactionIdCopied")))
                    .catch(() => toast.error(t("copyFailed")));
                }}
                aria-label={t("transactionIdCopied")}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        {/* 领取状态 */}
        <div className="flex flex-col gap-1">
          <span className="text-[12px] lg:hidden" style={{ color: "var(--text-secondary)" }}>{t("claimStatus")}</span>
          <span className="text-[12px] font-medium inline-flex items-center px-2 py-0.5 rounded w-fit"
          >
            {cs.label}
          </span>
        </div>
      </div>
    );
  };

  const renderCard = (record: OrderBookType) => {
    const isExpanded = expandedKeys.has(record.key);
    const ss = getStatusStyle(record.status);
    const children = Array.isArray(record.children) ? (record.children as any[]) : [];
    const hasChildren = children.length > 0;
    // 所有子订单均已领取(2)→ 聚合显示已领取
    const allClaimed = hasChildren && children.every((c) => c.claimStatus === 2);
    const isClaimed = claimingStatus[record.key] === t("claimSuccess");
    const canClaim = record.isClaimable;

    return (
      <div key={record.key}
        id={`order-card-${record.key}`}
        className="rounded-xl mb-3 overflow-hidden transition-shadow"
        style={{
          border: `1px solid var(--border)`,
          borderLeft: `3px solid ${ss.border}`,
          background: "var(--bg-card)",
          boxShadow: isExpanded ? "0 4px 16px 0 rgba(0,0,0,0.10)" : "none",
        }}>
        {/* ── 卡片头部 ── */}
        <div
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 px-3 py-3 cursor-pointer select-none"
          onClick={() => {
            if (!hasChildren) return;
            setExpandedKeys((prev) => {
              const next = new Set(prev);
              if (next.has(record.key)) next.delete(record.key);
              else next.add(record.key);
              return next;
            });
          }}
        >
          {/* 展开图标 */}
          <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center"
            style={{ color: "var(--text-secondary)", opacity: hasChildren ? 1 : 0.25 }}>
            {isExpanded ? <ChevronUp style={{ fontSize: 11 }} /> : <ChevronDown style={{ fontSize: 11 }} />}
          </span>

          {/* ── 左侧：联赛 + 比赛名 + 时间（弹性填充） ── */}
          <div className="flex-1 min-w-0 mr-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[12px] px-2 py-0.5 rounded whitespace-nowrap font-medium flex-shrink-0"
                style={{ background: "var(--muted)", color: "var(--text-secondary)" }}
              >
                {record.league}
              </span>
              <span className="text-[15px] font-semibold truncate flex items-center gap-1" style={{ color: "var(--text-primary)" }}>
                {(() => {
                  const parts = record.match.split(" vs ");
                  if (parts.length === 2) {
                    return <>
                      <span>{parts[0]}</span>
                      <span className="text-[12px] font-normal px-1" style={{ color: "var(--text-secondary)", opacity: 0.6 }}>vs</span>
                      <span>{parts[1]}</span>
                    </>;
                  }
                  return record.match;
                })()}
              </span>
            </div>
            {/* 资金池 & 占比 */}
            {(record.option1Turnover && record.option1Turnover !== "0" || record.option2Turnover && record.option2Turnover !== "0") && (() => {
              const parts = record.match.split(" vs ");
              const home = parts[0]?.trim() || "A";
              const away = parts[1]?.trim() || "B";
              const pool1 = parseFloat(record.option1Turnover || "0");
              const pool2 = parseFloat(record.option2Turnover || "0");
              const ratio = parseFloat(record.ownSideStakeRatio || "0");
              return (
                <div className="mt-0.5 text-[11px] font-number" style={{ color: "var(--text-secondary)" }}>
                  {home} ${pool1.toLocaleString()} : {away} ${pool2.toLocaleString()}
                  {ratio > 0 && (
                    <> · {t("myShare") || "我的占比"} <span style={{ color: "var(--accent)" }}>{ratio >= 1 ? `${(ratio * 100).toFixed(0)}%` : `${(ratio * 100).toFixed(1)}%`}</span></>
                  )}
                </div>
              );
            })()}
            <div className="mt-1">
              <span className="text-[12px] font-number" style={{ color: "var(--text-secondary)" }}>
                {record.matchTime}
              </span>
            </div>
          </div>
          {/* 右侧信息区域：桌面端横向，移动端整块换到第二行右侧 */}
          <div className="flex flex-row items-center gap-2 sm:gap-4 sm:ml-2 mt-2 sm:mt-0 sm:flex-shrink-0 sm:w-auto justify-between sm:justify-end">
            {/* 下注金额：桌面显示 */}
            <div className="flex-shrink-0 w-[72px] text-center hidden md:block">
              <div className="text-[12px] mb-0.5" style={{ color: "var(--text-secondary)" }}>{t("betAmount")}</div>
              <div className="text-[15px] font-bold font-number tabular-nums" style={{ color: "var(--text-primary)" }}>
                {record.totalStakeAmount}
              </div>
            </div>
            {/* 比分：桌面显示 */}
            <div className="flex-shrink-0 w-[80px] text-center hidden sm:block">
              <div className="text-[12px] mb-0.5" style={{ color: "var(--text-secondary)" }}>{t("matchResult")}</div>
              <div className="text-[16px] font-bold font-number tabular-nums" style={{ color: record.result === "- : -" ? "var(--text-secondary)" : "var(--accent)" }}>
                {record.result}
              </div>
            </div>
            {/* 状态：移动端只显示文字，桌面带标题 */}
            <div className="flex-shrink-0 flex flex-col items-end">
              <div className="text-[12px] mb-0.5 hidden sm:block" style={{ color: "var(--text-secondary)" }}>{t("status")}</div>
              <span
                className="text-[13px] font-semibold whitespace-nowrap"
              >
                {record.status}
              </span>
            </div>
            {/* 盈亏：桌面显示 */}
            <div className="flex-shrink-0 w-[126px] text-center hidden md:block">
              <div className="text-[12px] mb-0.5" style={{ color: "var(--text-secondary)" }}>{t("profitLoss")}</div>
              <div
                className="text-[15px] font-bold font-number tabular-nums"
                style={{ color: getPnlColor(record.profitLoss) }}
              >
                {record.profitLoss === "-" ? "-" : record.profitLoss.startsWith("-") ? record.profitLoss : record.profitLoss === "0.00" ? record.profitLoss : `+${record.profitLoss}`}
              </div>
            </div>
            {/* 可领金额：桌面显示 */}
            <div className="flex-shrink-0 w-[128px] text-center hidden md:block">
              <div className="text-[12px] mb-0.5" style={{ color: "var(--text-secondary)" }}>{t("claimableAmount")}</div>
              <div className="text-[15px] font-bold font-number tabular-nums" style={{ color: record.availableAmount === "-" ? "var(--text-secondary)" : "var(--green)" }}>
                {record.availableAmount}
              </div>
            </div>
            {/* 操作：移动端和桌面统一按钮位置 */}
            <div className="flex-shrink-0 w-[80px] flex justify-center" onClick={(e) => e.stopPropagation()}>
              {(isClaimed || allClaimed) ? (
                <span
                  className="text-[12px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap"
                  style={{ background: "rgba(0,200,83,0.12)", color: "var(--green)" }}
                >
                  ✓ {t("claimed")}
                </span>
              ) : (
                <span className="text-[14px]" style={{ color: "var(--text-secondary)", opacity: 0.35 }}>-</span>
              )}
            </div>
          </div>

          {/* ── 移动端补充字段行（sm 以下显示，比分 / 下注 / 盈亏 / 可领） ── */}
          <div className="sm:hidden grid grid-cols-2 gap-x-6 gap-y-2 pl-7 pb-3 w-full">
            {/* 赛事结果 */}
            <div>
              <div className="text-[11px] mb-0.5" style={{ color: "var(--text-secondary)" }}>{t("matchResult")}</div>
              <div
                className="text-[15px] font-bold font-number tabular-nums"
                style={{ color: record.result === "- : -" ? "var(--text-secondary)" : "var(--accent)" }}
              >
                {record.result}
              </div>
            </div>
            {/* 下注金额 */}
            <div>
              <div className="text-[11px] mb-0.5" style={{ color: "var(--text-secondary)" }}>{t("betAmount")}</div>
              <div className="text-[15px] font-bold font-number tabular-nums" style={{ color: "var(--text-primary)" }}>
                {record.totalStakeAmount}
              </div>
            </div>
            {/* 盈亏 */}
            <div>
              <div className="text-[11px] mb-0.5" style={{ color: "var(--text-secondary)" }}>{t("profitLoss")}</div>
              <div
                className="text-[15px] font-bold font-number tabular-nums"
                style={{ color: getPnlColor(record.profitLoss) }}
              >
                {record.profitLoss === "-"
                  ? "-"
                  : record.profitLoss.startsWith("-")
                  ? record.profitLoss
                  : record.profitLoss === "0.00"
                  ? record.profitLoss
                  : `+${record.profitLoss}`}
              </div>
            </div>
            {/* 可领金额 */}
            <div>
              <div className="text-[11px] mb-0.5" style={{ color: "var(--text-secondary)" }}>{t("claimableAmount")}</div>
              <div
                className="text-[15px] font-bold font-number tabular-nums"
                style={{ color: record.availableAmount === "-" ? "var(--text-secondary)" : "var(--green)" }}
              >
                {record.availableAmount}
              </div>
            </div>
          </div>
        </div>

        {/* ── 展开的投注明细 ── */}
        {isExpanded && hasChildren && (
          <div style={{ borderTop: `1px solid var(--border)`, background: "var(--bg-secondary)" }}>
            {/* 明细表头 */}
            <div className="hidden lg:grid grid-cols-9 gap-x-4 px-4 py-2.5"
              style={{ borderBottom: `1px solid var(--border)`, background: "var(--bg-card)" }}>
              {[t("handicapType"), t("betSelection"), t("betAmount"), t("profitLoss"), t("claimableAmount"), t("totalVolume") || "盘口总额", t("myShare") || "我的占比", t("transactionHash"), t("claimStatus")].map((h) => (
                <span key={h} className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>{h}</span>
              ))}
            </div>
            {/* 明细行 */}
            {(record.children as OrderDetailType[]).map(renderDetailRow)}
          </div>
        )}
      </div>
    );
  };

  // ──────────────────────────── 主渲染 ────────────────────────────

  return (
    <div>
      {/* 加载骨架 */}
      {orderBookLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl h-15 animate-pulse" style={{ background: "var(--bg-secondary)" }} />
          ))}
        </div>
      )}

      {/* 无数据 */}
      {!orderBookLoading && orderBookData.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <span className="text-4xl">📋</span>
          <span className="text-[14px]" style={{ color: "var(--text-secondary)" }}>{t("noOrders") || "暂无订单"}</span>
        </div>
      )}

      {/* 卡片列表 */}
      {!orderBookLoading && orderBookData.length > 0 && (
        <div>
          {orderBookData.map(renderCard)}
        </div>
      )}

      {/* 分页 */}
      {orderBookPagination.total > 0 && (
        <div
          className="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3 mt-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderTop: `1px solid var(--border)` }}
        >
          <div className="text-sm text-[var(--text-secondary)]">
            {t("totalRecords", {
              total: orderBookPagination.total.toString(),
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <span>Page size</span>
              <Select
                options={pageSizeOptions.map((size) => ({
                  value: size,
                  label: size.toString(),
                }))}
                value={orderBookPagination.pageSize}
                onChange={(nextPageSize) => {
                  if (nextPageSize !== orderBookPagination.pageSize) {
                    handleOrderBookPaginationChange(1, nextPageSize);
                  }
                }}
                className="min-w-[100px]"
                renderSelected={(option) => (
                  <span>{option.label} / page</span>
                )}
                renderOption={(option) => <span>{option.label} / page</span>}
              />
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const nextPage = orderBookPagination.current - 1;
                  if (nextPage >= 1) {
                    handleOrderBookPaginationChange(nextPage, orderBookPagination.pageSize);
                  }
                }}
                disabled={orderBookPagination.current <= 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[100px] text-center text-sm text-[var(--text-secondary)]">
                {orderBookPagination.current} / {Math.max(1, Math.ceil(orderBookPagination.total / orderBookPagination.pageSize))}
              </span>
              <button
                type="button"
                onClick={() => {
                  const totalPages = Math.max(1, Math.ceil(orderBookPagination.total / orderBookPagination.pageSize));
                  const nextPage = orderBookPagination.current + 1;
                  if (nextPage <= totalPages) {
                    handleOrderBookPaginationChange(nextPage, orderBookPagination.pageSize);
                  }
                }}
                disabled={orderBookPagination.current >= Math.max(1, Math.ceil(orderBookPagination.total / orderBookPagination.pageSize))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderBookTab;
