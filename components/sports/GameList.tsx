"use client";

import GameCard from "@/components/sports/Live/GameCard";
import { Game } from "@/types/types";
import { useTranslation } from "@/lib/i18n";

export interface GameProps {
  games: Game[];
  showTimeDivider?: boolean;
}

// 格式化日期显示（根据语言）
function formatGameDate(dateStr: string, locale: string): string {
  // 如果日期字符串已经是中文格式，直接返回
  if (/[\u4e00-\u9fa5]/.test(dateStr)) {
    return dateStr;
  }
  
  // 解析英文日期格式 "Tue, December 24"
  const match = dateStr.match(/(\w+),\s+(\w+)\s+(\d+)/);
  if (!match) return dateStr;
  
  const [_, weekday, month, day] = match;
  
  if (locale === 'zh-CN' || locale === 'zh-TW') {
    const weekdayMap: Record<string, string> = {
      'Mon': '周一', 'Tue': '周二', 'Wed': '周三', 'Thu': '周四',
      'Fri': '周五', 'Sat': '周六', 'Sun': '周日'
    };
    const monthMap: Record<string, string> = {
      'January': '1月', 'February': '2月', 'March': '3月', 'April': '4月',
      'May': '5月', 'June': '6月', 'July': '7月', 'August': '8月',
      'September': '9月', 'October': '10月', 'November': '11月', 'December': '12月'
    };
    return `${weekdayMap[weekday] || weekday}, ${monthMap[month] || month}${day}日`;
  }
  
  return dateStr;
}

export default function GameList({ games, showTimeDivider }: GameProps) {
  const { t, locale } = useTranslation();
  // 按日期和赛事分组
  const groupedByDate = games.reduce((acc, game) => {
    const date = game.startDate || "Unknown";
    if (!acc[date]) {
      acc[date] = {};
    }
    if (!acc[date][game.sport]) {
      acc[date][game.sport] = [];
    }
    acc[date][game.sport].push(game);
    return acc;
  }, {} as Record<string, Record<string, Game[]>>);

  return (
    <div className="flex flex-col gap-6">
      {Object.entries(groupedByDate).map(([date, sportGroups], dateIndex) => (
        <div key={date}>
          {/* 日期分隔 */}
          {showTimeDivider && (
            <div className="mb-4 text-sm font-semibold text-(--text-secondary)">
              {formatGameDate(date, locale)}
            </div>
          )}
          <div className="flex flex-col gap-6">
            {Object.entries(sportGroups).map(([sport, games]) => (
              <div key={sport} className="flex flex-col gap-2">
                <div className="flex gap-4 pr-3 max-md:hidden">
                  <div className="text-sm font-semibold">{sport}</div>
                  <div className="ml-auto uppercase text-xs text-(--text-secondary) w-32 text-center">
                    {t.sports.market.moneyline}
                  </div>
                  <div className="uppercase text-xs text-(--text-secondary) w-32 text-center">
                    {t.sports.market.spread}
                  </div>
                  <div className="uppercase text-xs text-(--text-secondary) w-32 text-center">
                    {t.sports.market.total}
                  </div>
                </div>
                {games.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
