import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from '@/lib/i18n';
import { ChevronDown, Loader2 } from "lucide-react";
import { getHoldRank } from "@/lib/api";
import { Holding, HoldRankGroup } from "@/types/types";
import { Popover } from "../ui/Popover";
import HoldersList from "../common/HoldersList";
import { PolymarketMarketResp } from '@/types/home';
import { normalizeBinaryOutcomeLabel } from "@/lib/utils/outcomes";

interface TopHoldersProps {
  markets: PolymarketMarketResp[];
}

/**
 * 根据选中 market.id 获取两档 Holders。
 * GET /holdings-rank?marketId=xxx&limit=15，返回按 outcomeName 分组的数组。
 *
 * 注：分组的 outcomeName 是市场真实档位名（yes/no、up/down、甚至队名），不能写死
 * 按 "YES"/"NO" 匹配（否则 up/down 等市场会全空、页面不展示）。统一按 originalIndex
 * 排序后取第 0/1 档，并把真实档位名一并返回用于列标题。
 */
function useHolders(market: PolymarketMarketResp | undefined) {
  // 默认 loading=true：接口返回前不渲染两列（避免空列闪现）
  const [loading, setLoading] = useState(true);
  const [firstHold, setFirstHold] = useState<Holding[]>([]);
  const [secondHold, setSecondHold] = useState<Holding[]>([]);
  const [firstName, setFirstName] = useState<string>('');
  const [secondName, setSecondName] = useState<string>('');

  useEffect(() => {
    if (!market?.id) {
      setFirstHold([]);
      setSecondHold([]);
      setFirstName('');
      setSecondName('');
      setLoading(false);
      return;
    }

    const asyncFn = async () => {
      setLoading(true);
      try {
        const res = await getHoldRank({ marketId: market.id, limit: 15 });
        if (res?.code === 200 && Array.isArray(res.data)) {
          const groups: HoldRankGroup[] = [...res.data].sort(
            (a, b) => (a.originalIndex ?? 0) - (b.originalIndex ?? 0)
          );
          const first = groups[0];
          const second = groups[1];
          setFirstHold(first?.rankings ?? []);
          setSecondHold(second?.rankings ?? []);
          setFirstName(first?.outcomeName ?? '');
          setSecondName(second?.outcomeName ?? '');
        } else {
          setFirstHold([]);
          setSecondHold([]);
          setFirstName('');
          setSecondName('');
        }
      } catch (err) {
        console.error('[TopHolders] Failed to fetch hold rank:', err);
        setFirstHold([]);
        setSecondHold([]);
        setFirstName('');
        setSecondName('');
      } finally {
        setLoading(false);
      }
    };
    asyncFn();
  }, [market?.id]);

  return { loading, firstHold, secondHold, firstName, secondName };
}



const TopHolders: React.FC<TopHoldersProps> = ({ markets }) => {
  const { t } = useTranslation();

  // 市场选项列表（和 outcome 列表数据源一致）
  const marketOptions = useMemo(() => {
    return markets.map(m => ({
      value: String(m.id),
      label: m.groupItemTitle || m.question || String(m.id),
    }));
  }, [markets]);

  const [selectedMarketId, setSelectedMarketId] = useState<string>(() => {
    return markets.length > 0 ? String(markets[0].id) : '';
  });

  const selectedMarket = useMemo(() => {
    return markets.find(m => String(m.id) === selectedMarketId);
  }, [markets, selectedMarketId]);

  const { loading, firstHold, secondHold, firstName, secondName } =
    useHolders(selectedMarket);

  // 列标题用真实档位名归一（yes/no、up/down、涨/跌…），回退到通用 Yes/No
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
                {marketOptions.find(o => o.value === selectedMarketId)?.label || ''}
                <ChevronDown
                  size={16}
                  className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
            )}
          </Popover>
        </div>
      )}

      {/* 持有者列表：接口返回前（loading）不渲染，避免空的两列闪现 */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-(--text-tertiary)" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-8">
          {/* 第一档（yes / up …） */}
          <HoldersList title={firstTitle} holders={firstHold} highlight="green" />

          {/* 第二档（no / down …） */}
          <HoldersList title={secondTitle} holders={secondHold} highlight="red" />
        </div>
      )}
    </>
  );
};

export default TopHolders;
