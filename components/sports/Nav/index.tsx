"use client";
import { BarChartBig, Radio, Flame } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { usePathname } from "next/navigation";
import useSportsStore, { type MenuKey } from "@/lib/stores/sportsStore";
import { NavItem } from "./NavItem";
import Drawer from "@/components/ui/Drawer";
import { useTranslation } from "@/lib/i18n";

export interface NavSportsProps {
  sports: Array<{
    name: string;
    id: string;
    count: number;
    category: string;
    categoryIcon: string;
    isHot: boolean;
    logo: string;
  }>;
}

export default function NavSports(props: NavSportsProps) {
  const { t } = useTranslation();
  const { sports } = props;
  const pathname = usePathname();
  const selectedMenu = useSportsStore((state) => state.selectedMenu);
  const setSelectedMenu = useSportsStore((state) => state.setSelectedMenu);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleCategoryClick = (category: string) => {
    setSelectedCategory((prev) => (prev === category ? null : category));
  };

  const popularSports = useMemo(() => sports.filter((s) => s.isHot), [sports]);
  const groupedSports = useMemo(() => {
    return sports.reduce((groups, sport) => {
      const category = sport.category;
      if (!groups[category]) groups[category] = [];
      groups[category].push(sport);
      return groups;
    }, {} as Record<string, typeof sports>);
  }, [sports]);

  const currentCategorySports = selectedCategory
    ? groupedSports[selectedCategory] || []
    : [];
  
  const currentCategoryIcon = selectedCategory 
    ? groupedSports[selectedCategory]?.[0]?.categoryIcon || ""
    : "";

  const isMenuActive = useCallback(
    (menu?: MenuKey, sportId?: string) => {
      if (selectedMenu) {
        if (menu) return selectedMenu === menu;
        if (sportId) return selectedMenu === `sport:${sportId}`;
        return false;
      }
      if (sportId) return pathname?.startsWith(`/sports/${sportId}`);
      if (menu === "live") return pathname === "/sports/live";
      if (menu === "futures") return pathname?.startsWith("/sports/futures");
      return false;
    },
    [selectedMenu, pathname]
  );

  const handleSelectMenu = useCallback(
    (menu?: MenuKey) => {
      setSelectedMenu(menu ?? null);
    },
    [setSelectedMenu]
  );

  const handleSelectSport = useCallback(
    (id: string) => setSelectedMenu(`sport:${id}`),
    [setSelectedMenu]
  );

  return (
    <div className="flex md:flex-col max-md:items-center gap-2">
      {/* Live 和 Futures 链接 */}
      <NavItem
        type="link"
        href="/sports/live"
        onClick={() => handleSelectMenu("live")}
        active={isMenuActive("live")}
        icon={<Radio className="w-5 h-5" />}
        label={t.sports.nav.live}
        className="flex-col md:flex-row"
      />
      <NavItem
        type="link"
        href="/sports/futures/nfl"
        onClick={() => handleSelectMenu("futures")}
        active={isMenuActive("futures")}
        icon={<BarChartBig className="w-5 h-5" />}
        label={t.sports.nav.futures}
        className="flex-col md:flex-row"
      />

      <div className="h-6 w-[1px] bg-[--border] flex-shrink-0 md:h-[1px] md:w-full"></div>

      {/* Popular 分组 */}
      {popularSports.length > 0 && (
        <>
          <h3 className="px-3 py-1.5 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide items-center gap-1 m-0 hidden md:flex">
            <Flame className="w-3 h-3 text-orange-500" />
            {t.sports.nav.popular}
          </h3>
          {popularSports.map((sport) => (
            <NavItem
              key={sport.id}
              type="link"
              href={`/sports/${sport.id}/games`}
              onClick={() => handleSelectSport(sport.id)}
              active={isMenuActive(undefined, sport.id)}
              icon={sport.logo}
              label={sport.name}
              badge={sport.count}
            />
          ))}
        </>
      )}

      {/* All Sports 分组 */}
      <h3 className="px-3 py-1.5 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide m-0 hidden md:block">
        {t.sports.nav.allSports}
      </h3>
      
      {Object.entries(groupedSports).map(([category, sportsGroup]) => {
        const isExpanded = selectedCategory === category;
        const categoryIcon = sportsGroup[0]?.categoryIcon || "";
        return (
          <div key={category} className="md:block">
            <NavItem
              type="button"
              onClick={() => handleCategoryClick(category)}
              active={false}
              icon={categoryIcon}
              label={category}
              expanded={isExpanded}
              className="flex-col md:flex-row"
            />
            {/* 桌面端展开内容 */}
            <div
              className={`hidden md:block overflow-hidden transition-all duration-300 ease-in-out ${
                isExpanded
                  ? "max-h-[500px] opacity-100"
                  : "max-h-0 opacity-0"
              }`}
            >
              <ul className="flex flex-col gap-1 mt-1 list-none pl-7">
                {sportsGroup.map((sport) => (
                  <NavItem
                    key={sport.id}
                    type="link"
                    href={sport.id === 'soccer-asian' ? '/sports/soccer/asian' : `/sports/${sport.id}/games`}
                    onClick={() => handleSelectSport(sport.id)}
                    active={isMenuActive(undefined, sport.id)}
                    label={sport.name}
                  />
                ))}
              </ul>
            </div>
          </div>
        );
      })}

      {/* 移动端抽屉 */}
      <Drawer
        isOpen={selectedCategory !== null}
        onClose={() => setSelectedCategory(null)}
        title={
          <div className="flex items-center gap-2">
            <span className="text-2xl">{currentCategoryIcon}</span>
            <span>{selectedCategory}</span>
          </div>
        }
        className="md:hidden"
      >
        <ul className="pb-3">
          {currentCategorySports.map((sport) => (
            <li key={sport.id}>
              <a
                href={sport.id === 'soccer-asian' ? '/sports/soccer/asian' : `/sports/${sport.id}/games`}
                onClick={() => {
                  handleSelectSport(sport.id);
                  setSelectedCategory(null);
                }}
                className={`block px-6 py-3 transition-colors ${
                  isMenuActive(undefined, sport.id)
                    ? "bg-[var(--bg-secondary)] text-[var(--accent)]"
                    : "hover:bg-[var(--bg-hover)]"
                }`}
              >
                {sport.name}
              </a>
            </li>
          ))}
        </ul>
      </Drawer>
    </div>
  );
}
