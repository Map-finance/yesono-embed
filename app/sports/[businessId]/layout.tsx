"use client";

import OddsFormatSetting from "@/components/sports/OddsFormatSetting";
import IconButton from "@/components/ui/IconButton";
import { Popover } from "@/components/ui/Popover";
import { Switch } from "@/components/ui/Switch";
import { ChevronDown, Settings } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import ButtonSwitch from "@/components/ui/ButtonSwitch";
import Drawer from "@/components/ui/Drawer";

export default function SportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showSpreads, setShowSpreads] = useState(false);
  const pathname = usePathname();
  const isGamesActive = pathname.endsWith("/games");
  const isPropsActive = pathname.endsWith("/props");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div>
      {(isGamesActive || isPropsActive) && (
        <>
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="text-3xl font-semibold flex gap-2">
                <span>🏈</span>
                <span>NFL</span>
              </div>
              {isGamesActive && (
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
                    className="flex items-center border border-(--border) rounded-md px-3 py-1 gap-2 cursor-pointer hover:bg-(--bg-hover) transition-all text-xs max-md:hidden"
                    onClick={() => setShowSpreads(!showSpreads)}
                  >
                    <Switch
                      checked={showSpreads}
                      onCheckedChange={setShowSpreads}
                    />
                    <span>Show Spreads + Totals</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <ButtonSwitch
              options={[
                {
                  label: (
                    <a
                      href="games"
                      className="size-full flex items-center justify-center"
                    >
                      Games
                    </a>
                  ),
                  value: "games",
                },
                {
                  label: (
                    <a
                      href="props"
                      className="size-full flex items-center justify-center"
                    >
                      Props
                    </a>
                  ),
                  value: "props",
                },
              ]}
              value={pathname.split("/").pop()}
            />
            {isGamesActive && (
              <div className="px-3 gap-2 cursor-pointer h-[40px] flex items-center justify-center rounded-[20px] bg-(--bg-secondary)">
                <div>Week 13</div>
                <ChevronDown size={20} />
              </div>
            )}
          </div>
        </>
      )}

      <div>{children}</div>

      <Drawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Settings"
        className="md:hidden"
      >
        <div className="px-3 pb-4">
          <OddsFormatSetting className="w-full" />
        </div>
      </Drawer>
    </div>
  );
}
