import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { ChevronDown, Loader2 } from "lucide-react";
import { getHoldRankPnl } from "@/lib/api";
import { Holding, HoldRankGroup } from "@/types/types";
import { Popover } from "../ui/Popover";
import Avatar from "@/components/common/Avatar";
import { UserProfile } from "@/components/common/UserProfile";
import { PolymarketMarketResp } from "@/types/home";

interface PositionsProps {
  markets: PolymarketMarketResp[];
}

function usePositions(market: PolymarketMarketResp | undefined) {
  const [loading, setLoading] = useState(false);
  const [yesHold, setYesHold] = useState<Holding[]>([]);
  const [noHold, setNoHold] = useState<Holding[]>([]);

  useEffect(() => {
    if (!market?.id) {
      setYesHold([]);
      setNoHold([]);
      return;
    }

    const asyncFn = async () => {
      setLoading(true);
      try {
        const res = await getHoldRankPnl({ marketId: market.id });
        if (res?.code === 200 && Array.isArray(res.data)) {
          const groups: HoldRankGroup[] = res.data;
          const yesGroup = groups.find(g => g.outcomeName?.toUpperCase() === "YES");
          const noGroup = groups.find(g => g.outcomeName?.toUpperCase() === "NO");
          setYesHold(yesGroup?.rankings ?? []);
          setNoHold(noGroup?.rankings ?? []);
        } else {
          setYesHold([]);
          setNoHold([]);
        }
      } catch (err) {
        console.error("[Positions] Failed to fetch PnL:", err);
        setYesHold([]);
        setNoHold([]);
      } finally {
        setLoading(false);
      }
    };
    asyncFn();
  }, [market?.id]);

  return { loading, yesHold, noHold };
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
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--border)]">
        <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
        <div className="flex items-center gap-3 sm:gap-4 text-xs text-[var(--text-secondary)] uppercase">
          <span>{t.market.shares}</span>
          <span className="w-12 sm:w-14 text-right">{t.market.avgPrice}</span>
          <span className="w-12 sm:w-14 text-right">{t.market.profitLoss}</span>
        </div>
      </div>
      {/* List */}
      <div className="space-y-1">
        {holders.length === 0 ? (
          <div className="text-center py-4 text-xs text-[var(--text-tertiary)]">
            {t.market.noPositionData}
          </div>
        ) : (
          holders.map((holder) => {
            const profitNum = Number(holder.profit ?? 0);
            const profitColor =
              profitNum > 0
                ? "text-[var(--green)]"
                : profitNum < 0
                ? "text-[var(--red)]"
                : "text-[var(--text-secondary)]";
            const profitSign = profitNum > 0 ? "+" : "";

            return (
              <div
                key={holder.userId}
                className="flex items-center gap-2 sm:gap-3 py-1.5 hover:bg-[var(--bg-hover)] rounded-lg px-2 -mx-2 cursor-pointer"
              >
                <UserProfile userId={holder.userId} displayName={holder.userName}>
                  <Avatar name={holder.userName} id={holder.userId} size="sm" />
                </UserProfile>
                <UserProfile userId={holder.userId} displayName={holder.userName}>
                  <span className="text-sm text-[var(--text-primary)] truncate hover:underline cursor-pointer min-w-0 flex-1">
                    {holder.userName}
                  </span>
                </UserProfile>
                <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                  <span
                    className={`text-sm font-medium tabular-nums ${
                      highlight === "green" ? "text-[var(--green)]" : "text-[var(--red)]"
                    }`}
                  >
                    {Number(holder.size).toLocaleString()}
                  </span>
                  <span className="w-12 sm:w-14 text-right text-sm tabular-nums text-[var(--text-secondary)]">
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

  const [selectedMarketId, setSelectedMarketId] = useState<string>(() => {
    return markets.length > 0 ? String(markets[0].id) : "";
  });

  const selectedMarket = useMemo(() => {
    return markets.find(m => String(m.id) === selectedMarketId);
  }, [markets, selectedMarketId]);

  const { loading, yesHold, noHold } = usePositions(selectedMarket);

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
                    className={`w-full text-left p-2 rounded-sm transition-[--transition-fast] bg-transparent hover:bg-[--bg-hover] ${
                      selectedMarketId === option.value
                        ? "text-[var(--accent)]"
                        : "text-[var(--text-primary)]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          >
            {({ isOpen }) => (
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-primary)] hover:border-[var(--border-light)]">
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
          <Loader2 className="w-5 h-5 animate-spin text-[var(--text-tertiary)]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
          <PositionList
            title={t.market.yesHolders}
            holders={yesHold}
            highlight="green"
            t={t}
          />
          <PositionList
            title={t.market.noHolders}
            holders={noHold}
            highlight="red"
            t={t}
          />
        </div>
      )}
    </>
  );
};

export default Positions;
