"use client";

import GameButton from "@/components/sports/Live/GameButton";
import Tabs from "@/components/ui/Tabs";
import { ChevronRightIcon, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Game, Market } from "@/types/types";
import { useRouter } from "next/navigation";
import IconButton from "@/components/ui/IconButton";
import { getRecommendations } from "@/lib/services/recommendations";
import { MarketChart } from "@/components/detail";
import { useTranslation } from "@/lib/i18n";
import ProxyImage from "@/components/common/ProxyImage";

export interface GameCardProps {
  game: Game;
}

export default function GameCard({ game }: GameCardProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [market, setMarket] = useState<Market | null>(null);
  const [selectedMarketId, setSelectedMarketId] = useState<string>(game.markets[0]?.id || '');
  const router = useRouter();

  useEffect(() => {
    getRecommendations().then((res) => {
      setMarket(res.markets[0]);
    });
  }, []);

  // 默认选中第一个盘口
  useEffect(() => {
    if (game.markets.length > 0 && !selectedMarketId) {
      setSelectedMarketId(game.markets[0].id);
    }
  }, [game.markets, selectedMarketId]);

  const handleToGameView = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/sports/${game.sport}/games/${game.id}`);
  };

  // 点击购买按钮时选中该盘口
  const handleMarketClick = (e: React.MouseEvent, marketId: string) => {
    e.stopPropagation();
    setSelectedMarketId(marketId);
  };

  // 获取按钮颜色
  const getButtonColor = (marketId: string, team: 'home' | 'away') => {
    if (selectedMarketId !== marketId) {
      return '#3A3A3A'; // 未选中的盘口使用默认颜色
    }
    // 选中的盘口使用队伍主色调
    return team === 'home' ? game.homeTeam.primaryColor : game.awayTeam.primaryColor;
  };

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      <div
        className="p-2 px-3 cursor-pointer hover:bg-[var(--bg-hover)] transition-all"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-between items-center">
          <div className="text-xs flex items-center gap-2 font-semibold">
            {game.status === "LIVE" ? (
              <>
                <div className="text-red flex items-center gap-1">
                  <div>LIVE</div>
                  <div className="bg-current size-2 rounded-full"></div>
                </div>
                <div>
                  {game.period}
                  {game.time && ` - ${game.time}`}
                </div>
              </>
            ) : (
              <div className="text-[var(--text-secondary)]  bg-[var(--bg-secondary)] px-2 rounded-sm">
                {game.startTime}
              </div>
            )}
            <div className="text-[var(--text-secondary)]">
              $ {game.volume} {t.sports.game.vol}
            </div>
          </div>
          <div
            className="flex items-center bg-[var(--bg-hover)] rounded-sm overflow-hidden text-xs pl-2 py-1 gap-2 hover:bg-[var(--bg-secondary)] transition-all"
            onClick={handleToGameView}
          >
            <div className="bg-[var(--bg-primary)] px-1 py-[1px] rounded-sm text-xs border border-[var(--border)] text-[var(--text-secondary)]">
              {game.marketCount}
            </div>
            <div className="font-semibold">{t.sports.game.gameView}</div>
            <ChevronRightIcon size={18} />
          </div>
        </div>
        <div className="flex justify-between items-center mt-3 max-md:flex-col max-md:gap-4 max-md:items-start">
          <div className="space-y-3">
            {/* Team A (Away) */}
            <div className="flex items-center gap-4">
              <div className="px-2 bg-[var(--bg-secondary)] rounded-sm py-[1px]">
                {game.awayTeam.seed}
              </div>
                {/**
                 * 中文注释：
                 * - 这里原本使用 next/image，但 next/image 受 remotePatterns 白名单限制，
                 *   很容易出现“部分域名图片不显示”。
                 * - 改为 ProxyImage，优先走 /i 代理并提供失败回退。
                 */}
                <ProxyImage
                  src={game.awayTeam.logo}
                  alt={`${game.awayTeam.name} Logo`}
                  className="h-6 w-auto object-contain"
                />
              <div className="text-sm">{game.awayTeam.name}</div>
              <div className="text-xs text-[var(--text-secondary)]">
                {game.awayTeam.record}
              </div>
            </div>
            {/* Team B (Home) */}
            <div className="flex items-center gap-4">
              <div className="px-2 bg-[var(--bg-secondary)] rounded-sm py-[1px]">
                {game.homeTeam.seed}
              </div>
                <ProxyImage
                  src={game.homeTeam.logo}
                  alt={`${game.homeTeam.name} Logo`}
                  className="h-6 w-auto object-contain"
                />
              <div className="text-sm">{game.homeTeam.name}</div>
              <div className="text-xs text-[var(--text-secondary)]">
                {game.homeTeam.record}
              </div>
            </div>
          </div>
          <div className="flex gap-4 max-md:w-full">
            {game.markets.map((market, index) => (
              <div key={market.id} className={`gap-2 flex flex-col ${index > 0 ? 'max-md:hidden' : 'max-md:flex-row max-md:w-full'}`}>
                {/* Away team option */}
                <GameButton
                  className="w-32 max-md:w-auto max-md:flex-1"
                  color={getButtonColor(market.id, 'away')}
                  onClick={(e) => handleMarketClick(e, market.id)}
                  disabled={market.options[0].disabled}
                >
                  <span className="uppercase opacity-80">
                    {market.options[0].label}
                  </span>
                  {market.options[0].odds && (
                    <span className="ml-2 font-bold">{market.options[0].odds}</span>
                  )}
                </GameButton>
                {/* Home team option */}
                <GameButton
                  className="w-32 max-md:w-auto max-md:flex-1"
                  color={getButtonColor(market.id, 'home')}
                  onClick={(e) => handleMarketClick(e, market.id)}
                  disabled={market.options[1].disabled}
                >
                  <span className="uppercase opacity-80">
                    {market.options[1].label}
                  </span>
                  {market.options[1].odds && (
                    <span className="ml-2 font-bold">{market.options[1].odds}</span>
                  )}
                </GameButton>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 展开的面板 */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out flex"
        style={{
          maxHeight: isExpanded ? "500px" : "0",
          opacity: isExpanded ? 1 : 0,
        }}
      >
        <Tabs
          items={[
            {
              label: t.sports.game.orderBook,
              value: "orderbook",
              content: <div className="p-4">todo: OrderBook Content</div>,
            },
            {
              label: t.sports.game.graph,
              value: "graph",
              content: (
                <div className="p-4">
                  {market && <MarketChart market={market} />}
                </div>
              ),
            },
          ]}
          defaultValue="orderbook"
          rightSlot={
            <div className="mr-2">
              <IconButton size="sm">
                <RefreshCcw size={14} />
              </IconButton>
            </div>
          }
        />
      </div>
    </div>
  );
}
