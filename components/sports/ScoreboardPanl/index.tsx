import NumberFlow from "@number-flow/react";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";

export default function ScoreboardPanel() {
  const { t } = useTranslation();
  const isLive = true;
  const [leftScore, setLeftScore] = useState(63);
  const [rightScore, setRightScore] = useState(53);

  useEffect(() => {
    const interval = setInterval(() => {
      // 随机选择哪个队伍得分
      if (Math.random() > 0.5) {
        setLeftScore(prev => prev + Math.floor(Math.random() * 5) + 1);
      } else {
        setRightScore(prev => prev + Math.floor(Math.random() * 5) + 1);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // 示例数据（可替换为动态数据）
  const leftPercent = 72;
  const rightPercent = 100 - leftPercent;
  const leftTeamLogo =
    "https://img.logo.dev/patriots.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=512";
  const rightTeamLogo =
    "https://img.logo.dev/buffalobills.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128";

  return (
    <div className="relative">
      <div className="absolute z-0 top-0 left-0 w-full h-full pointer-events-none stroke-(--border) flex flex-col overflow-hidden stroke-[1px]">
        <svg
          width="100%"
          height="44"
          viewBox="0 0 1200 92"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="min-h-[44px] max-h-[44px]"
        >
          <path
            d="M1 105V30C0 13 13 0 30 0H380C400 0 410 66 440 66H760C790 66 800 0 820 0H1170C1187 0 1199.5 13 1199 30V105"
            fill="none"
            className="translate-y-px"
          ></path>
        </svg>

        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1200 400"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="flex-1"
        >
          <path
            d="M1 -100V404"
            style={{
              transition:
                "stroke 100ms ease-out, stroke-width 100ms ease-out, transform 100ms ease-out, fill 100ms ease-out",
            }}
          ></path>
          <path
            d="M1199 -200V404"
            style={{
              transition:
                "stroke 100ms ease-out, stroke-width 100ms ease-out, transform 100ms ease-out, fill 100ms ease-out",
            }}
          ></path>
        </svg>

        <svg
          width="100%"
          height="44"
          viewBox="0 0 1200 92"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="min-h-[44px] max-h-[44px]"
        >
          <path
            d="M1 -44V62C0 79 13 92 30 92H1170C1187 92 1199 79 1199 62V-44"
            fill="none"
            pathLength="1"
            stroke-dasharray="1"
            stroke-dashoffset="0"
            className="-translate-y-px"
            style={{
              transition:
                "stroke 100ms ease-out, stroke-width 100ms ease-out, transform 100ms ease-out, fill 100ms ease-out",
            }}
          ></path>
        </svg>
      </div>
      <div className="relative z-10">
        <div className="h-[44px] font-semibold text-xs flex justify-center items-start gap-2">
          {isLive ? (
            <div className="flex items-center gap-2">
              <div className="font-bold">LIVE</div>
              <div className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-red"></span>
              </div>
              <div>Q2 - 07:18</div>
            </div>
          ) : (
            <span className="px-2 bg-(--bg-secondary) py-1 rounded-md">
              11:30 AM
            </span>
          )}
        </div>
        <div className="flex items-center justify-around gap-6 pb-[30px]">
          <div className="flex flex-col items-center relative">
            <div className="absolute inset-0 -z-10 size-[60px] pointer-events-none">
              <div
                className="absolute inset-0 bg-center bg-cover scale-[200%] origin-[center_15%] blur-xs filter opacity-20"
                style={{ backgroundImage: `url(${leftTeamLogo})` }}
              />
            </div>
            <Image
              src={leftTeamLogo}
              width={60}
              height={60}
              alt=""
              className="size-[60px]"
            />
            <div className="mt-2">Patriots</div>
            <div className="text-sm text-(--text-secondary)">17-10</div>
          </div>

          <div className="flex flex-col items-center">
            <div className="text-4xl font-bold flex items-center gap-2">
              <NumberFlow value={leftScore} />
              <div className="h-1 bg-current w-3"></div>
              <NumberFlow value={rightScore} />
            </div>
            <div className="flex items-center gap-3 w-[180px] mt-2 group">
              <div className="w-8 font-semibold text-right invisible group-hover:visible">
                {leftPercent}%
              </div>
              <div className="flex-1">
                <div
                  className="w-full h-3 flex gap-1"
                  role="img"
                  aria-label={`Home ${leftPercent}% vs Away ${rightPercent}%`}
                >
                  <div
                    className="h-full bg-[#D62E20]"
                    style={{ width: `${leftPercent}%` }}
                  />
                  <div
                    className="h-full bg-[#142C86]"
                    style={{ width: `${rightPercent}%` }}
                  />
                </div>
              </div>
              <div className="w-8 font-semibold invisible group-hover:visible">
                {rightPercent}%
              </div>
            </div>
            <div className="text-xs text-(--text-secondary) mt-1">
              $5.47m {t.sports.game.vol}.
            </div>
            <div className="text-xl font-semibold mt-3 text-(--text-secondary) opacity-50">
              YesONo
            </div>
          </div>

          <div className="flex flex-col items-center relative">
            <div className="absolute inset-0 -z-10 size-[60px] pointer-events-none">
              <div
                className="absolute inset-0 bg-center bg-cover scale-[200%] origin-[center_15%] blur-xs filter opacity-20"
                style={{ backgroundImage: `url(${rightTeamLogo})` }}
              />
            </div>
            <Image
              src={rightTeamLogo}
              width={60}
              height={60}
              alt=""
              className="size-[60px]"
            />
            <div className="mt-2">Bills</div>
            <div className="text-sm text-(--text-secondary)">19-9</div>
          </div>
        </div>
      </div>
    </div>
  );
}
