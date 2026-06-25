import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { ChevronDown, Loader2 } from "lucide-react";
import { getHoldRankPnl } from "@/lib/api";
import { Holding, HoldRankGroup } from "@/types/types";
import { Popover } from "../ui/Popover";
import Avatar from "@/components/common/Avatar";
import { UserProfile } from "@/components/common/UserProfile";
import { PolymarketMarketResp } from "@/types/home";
import { normalizeBinaryOutcomeLabel } from "@/lib/utils/outcomes";
import { pickDefaultMarket } from "@/lib/utils/marketSelection";

interface PositionsProps {
  markets: PolymarketMarketResp[];
}

// 注：分组 outcomeName 是真实档位名（yes/no、up/down、队名…），不能写死按 YES/NO
// 匹配（否则 up/down 等市场全空、不展示）。统一按 originalIndex 取第 0/1 档，并返回
// 真实档位名用于列标题。
function usePositions(market: PolymarketMarketResp | undefined) {
  // 默认 loading=true：接口返回前不渲染两列（避免空列闪现）
  const [loading, setLoading] = useState(true);
  const [firstHold, setFirstHold] = useState<Holding[]>([]);
  const [secondHold, setSecondHold] = useState<Holding[]>([]);
  const [firstName, setFirstName] = useState<string>("");
  const [secondName, setSecondName] = useState<string>("");

  useEffect(() => {
    if (!market?.id) {
      setFirstHold([]);
      setSecondHold([]);
      setFirstName("");
      setSecondName("");
      setLoading(false);
      return;
    }

    const asyncFn = async () => {
      setLoading(true);
      try {
        const res = await getHoldRankPnl({ marketId: market.id });
        if (res?.code === 200 && Array.isArray(res.data)) {
          const groups: HoldRankGroup[] = [...res.data].sort(
            (a, b) => (a.originalIndex ?? 0) - (b.originalIndex ?? 0)
          );
          const first = groups[0];
          const second = groups[1];
          setFirstHold(first?.rankings ?? []);
          setSecondHold(second?.rankings ?? []);
          setFirstName(first?.outcomeName ?? "");
          setSecondName(second?.outcomeName ?? "");
        } else {
          setFirstHold([]);
          setSecondHold([]);
          setFirstName("");
          setSecondName("");
        }
      } catch (err) {
        console.error("[Positions] Failed to fetch PnL:", err);
        setFirstHold([]);
        setSecondHold([]);
        setFirstName("");
        setSecondName("");
      } finally {
        setLoading(false);
      }
    };
    asyncFn();
  }, [market?.id]);

  return { loading, firstHold, secondHold, firstName, secondName };
}

interface PositionListProps {
  title: string;
  holders: Holding[];
  highlight?: "green" | "red";
  t: ReturnType<typeof useTranslation>["t"];
}

const PositionList: React.FC<PositionListProps> = ({ title, holders, highlight = "green", t }) => {
  return (
    <div className="min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-(--border)">
        <span className="text-sm font-medium text-(--text-primary)">{title}</span>
        <div className="flex items-center gap-3 sm:gap-4 text-xs text-(--text-secondary) uppercase">
          <span>{t.market.shares}</span>
          <span className="w-12 sm:w-14 text-right">{t.market.avgPrice}</span>
          <span className="w-12 sm:w-14 text-right">{t.market.profitLoss}</span>
        </div>
      </div>
      {/* List */}
      <div className="space-y-1">
        {holders.length === 0 ? (
          <div className="text-center py-4 text-xs text-(--text-tertiary)">
            {t.market.noPositionData}
          </div>
        ) : (
          holders.map((holder) => {
            const profitNum = Number(holder.profit ?? 0);
            const profitColor =
              profitNum > 0
                ? "text-(--green)"
                : profitNum < 0
                ? "text-(--red)"
                : "text-(--text-secondary)";
            const profitSign = profitNum > 0 ? "+" : "";

            return (
              <div
                key={holder.userId}
                className="flex items-center gap-2 sm:gap-3 py-1.5 hover:bg-(--bg-hover) rounded-lg px-2 -mx-2 cursor-pointer"
              >
                <UserProfile userId={holder.userId} displayName={holder.userName}>
                  <Avatar name={holder.userName} size={32} />
                </UserProfile>
                <UserProfile userId={holder.userId} displayName={holder.userName}>
                  <span className="text-sm text-(--text-primary) truncate hover:underline cursor-pointer min-w-0 flex-1">
                    {holder.userName}
                  </span>
                </UserProfile>
                <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                  <span
                    className={`text-sm font-medium tabular-nums ${
                      highlight === "green" ? "text-(--green)" : "text-(--red)"
                    }`}
                  >
                    {Number(holder.size).toLocaleString()}
                  </span>
                  <span className="w-12 sm:w-14 text-right text-sm tabular-nums text-(--text-secondary)">
                    {holder.avgPrice ? `$${Number(holder.avgPrice).toFixed(2)}` : "—"}
                  </span>
                  <span className={`w-12 sm:w-14 text-right text-sm font-medium tabular-nums ${profitColor}`}>
                    {holder.profit != null ? `${profitSign}$${Math.abs(profitNum).toFixed(2)}` : "—"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const Positions: React.FC<PositionsProps> = ({ markets }) => {
  const { t } = useTranslation();

  const marketOptions = useMemo(() => {
    return markets.map(m => ({
      value: String(m.id),
      label: m.groupItemTitle || m.question || String(m.id),
    }));
  }, [markets]);

  // 默认选首个"未结算"市场;全已结算才回退首项。
  // markets 常按 volume 排序,首项可能是已结算高额档,直接 markets[0] 会让 Positions
  // 默认落到已结算市场,与列表里高亮的活跃市场错位(与 TopHolders / page 同口径)
  const [selectedMarketId, setSelectedMarketId] = useState<string>(() =>
    String(pickDefaultMarket(markets)?.id ?? "")
  );

  const selectedMarket = useMemo(() => {
    return markets.find(m => String(m.id) === selectedMarketId);
  }, [markets, selectedMarketId]);

  const { loading, firstHold, secondHold, firstName, secondName } =
    usePositions(selectedMarket);

  // 列标题用真实档位名归一（yes/no、up/down…），回退到通用 Yes/No
  const outcomeDict = {
    yes: t.common.yes as string,
    no: t.common.no as string,
    up: t.common.up as string,
    down: t.common.down as string,
  };
  const firstTitle = normalizeBinaryOutcomeLabel(
    firstName,
    t.common.yes as string,
    outcomeDict
  );
  const secondTitle = normalizeBinaryOutcomeLabel(
    secondName,
    t.common.no as string,
    outcomeDict
  );

  return (
    <>
      {/* 市场选择器 */}
      {marketOptions.length > 1 && (
        <div className="mb-6 relative">
          <Popover
            placement="bottom-left"
            className="inline-block"
            content={({ close }) => (
              <div className="w-[240px] text-sm max-h-[300px] overflow-y-auto">
                {marketOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSelectedMarketId(option.value);
                      close();
                    }}
                    className={`w-full text-left p-2 rounded-sm transition-(--transition-fast) bg-transparent hover:bg-(--bg-hover) ${
                      selectedMarketId === option.value
                        ? "text-(--accent)"
                        : "text-(--text-primary)"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          >
            {({ isOpen }) => (
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-(--border) bg-(--bg-card) text-sm text-(--text-primary) hover:border-(--border-light)">
                {marketOptions.find(o => o.value === selectedMarketId)?.label || ""}
                <ChevronDown
                  size={16}
                  className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
            )}
          </Popover>
        </div>
      )}

      {/* 加载状态 */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-(--text-tertiary)" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
          <PositionList
            title={firstTitle}
            holders={firstHold}
            highlight="green"
            t={t}
          />
          <PositionList
            title={secondTitle}
            holders={secondHold}
            highlight="red"
            t={t}
          />
        </div>
      )}
    </>
  );
};

export default Positions;
