"use client";

import GameList from "@/components/sports/GameList";
import OddsFormatSetting from "@/components/sports/OddsFormatSetting";
import Drawer from "@/components/ui/Drawer";
import IconButton from "@/components/ui/IconButton";
import { Popover } from "@/components/ui/Popover";
import { Switch } from "@/components/ui/Switch";
import { mockGames } from "@/lib/mockData";
import { Settings } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";

export interface GamesProps {}

export default function LiveGames() {
  const { t } = useTranslation();
  const [showSpreads, setShowSpreads] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-3xl font-semibold">{t.sports.live.title}</div>
        <div className="flex items-center gap-3 select-none">
          <div className="max-md:hidden">
            <Popover
              content={<OddsFormatSetting />}
              placement="bottom"
              trigger="click"
            >
              <IconButton>
                <Settings size={20} />
              </IconButton>
            </Popover>
          </div>
          <div className="md:hidden">
            <IconButton onClick={() => setIsSettingsOpen(true)}>
              <Settings size={20} />
            </IconButton>
          </div>
          <div
            className="flex items-center border border-(--border) rounded-md px-3 py-2 gap-2 cursor-pointer hover:bg-(--bg-hover) transition-all text-xs max-md:hidden"
            onClick={() => setShowSpreads(!showSpreads)}
          >
            <Switch checked={showSpreads} onCheckedChange={setShowSpreads} />
            <span>{t.sports.live.showSpreads}</span>
          </div>
        </div>
      </div>
      <GameList games={mockGames} showTimeDivider={false} />
      <Drawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title={t.sports.live.settings}
        className="md:hidden"
      >
        <div className="px-3 pb-4">
          <OddsFormatSetting className="w-full" />
        </div>
      </Drawer>
    </div>
  );
}
