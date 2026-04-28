import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from '@/lib/i18n';
import { ChevronDown } from "lucide-react";
import { getHoldRank } from "@/lib/api";
import { Holding, HoldRankGroup } from "@/types/types";
import { Popover } from "../ui/Popover";
import HoldersList from "../common/HoldersList";
import { PolymarketMarketResp } from '@/types/home';

interface TopHoldersProps {
  markets: PolymarketMarketResp[];
}

/**
 * 根据选中 market.id 获取 Yes/No Holders
 * 新接口：GET /holdings-rank?marketId=xxx&limit=15
 * 返回按 outcomeName 分组的数组，每组含 rankings: Holding[]
 */
function useHolders(market: PolymarketMarketResp | undefined) {
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
        const res = await getHoldRank({ marketId: market.id, limit: 15 });
        if (res?.code === 200 && Array.isArray(res.data)) {
          const groups: HoldRankGroup[] = res.data;
          const yesGroup = groups.find(g => g.outcomeName?.toUpperCase() === 'YES');
          const noGroup = groups.find(g => g.outcomeName?.toUpperCase() === 'NO');
          setYesHold(yesGroup?.rankings ?? []);
          setNoHold(noGroup?.rankings ?? []);
        } else {
          setYesHold([]);
          setNoHold([]);
        }
      } catch (err) {
        console.error('[TopHolders] Failed to fetch hold rank:', err);
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

  const { loading, yesHold, noHold } = useHolders(selectedMarket);

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

      {/* 持有者列表 */}
      <div className="grid grid-cols-2 gap-8">
        {/* Yes Holders */}
        <HoldersList title={t.market.yesHolders} holders={yesHold} highlight="green" />

        {/* No Holders */}
        <HoldersList title={t.market.noHolders} holders={noHold} highlight="red" />
      </div>
    </>
  );
};

export default TopHolders;
