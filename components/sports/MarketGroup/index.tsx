import GameButton from "@/components/sports/Live/GameButton";
import MarketAbout from "@/components/sports/MarketAbout";
import IconButton from "@/components/ui/IconButton";
import Tabs from "@/components/ui/Tabs";
import { ChevronLeft, ChevronRightIcon, RefreshCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";

export default function MarketGroup() {
  return (
    <div className="flex flex-col gap-4">
      <MarketSection
        title="Moneyline"
        volume={2000000}
        outcomes={[
          { id: "1", label: "PAT", price: 0.52 },
          { id: "2", label: "BIL", price: 0.49 },
        ]}
        marketId={"1"}
      />
      <MarketSection
        title="Spreads"
        volume={1_500_000}
        lines={[
          { id: "1", description: "1.5" },
          { id: "2", description: "2.5" },
          { id: "3", description: "3.5" },
          { id: "4", description: "5.5" },
        ]}
        outcomes={[
          { id: "1", label: "PAT", price: 0.52 },
          { id: "2", label: "BIL", price: 0.49 },
        ]}
        marketId={"2"}
      />
      <MarketSection
        title="Totals"
        volume={1_200_000}
        lines={[
          { id: "1", description: "42.5" },
          { id: "2", description: "44.5" },
          { id: "3", description: "46.5" },
          { id: "4", description: "48.5" },
        ]}
        outcomes={[
          { id: "1", label: "PAT", price: 0.52 },
          { id: "2", label: "BIL", price: 0.49 },
        ]}
        marketId={"3"}
      />
    </div>
  );
}

type Line = {
  id: string;
  description: string;
};
type Outcome = {
  id: string;
  label: string;
  price: number;
};

interface MarketSectionProps {
  marketId: string;
  title: string;
  volume: number;
  lines?: Line[];
  outcomes: Outcome[];
}

function MarketSection(props: MarketSectionProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-(--border) rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between p-4 hover:bg-(--bg-secondary) transition-colors cursor-pointer max-md:flex-col max-md:gap-3 max-md:items-start"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <MarketHeader title={props.title} volume={props.volume} />
        <div className="max-md:w-full">
          <OutcomeGrid outcomes={props.outcomes} />
        </div>
      </div>
      {props.lines && <LineSelector lines={props.lines} />}
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
              content: <div className="p-4">todo: Graph Content</div>,
            },
            {
              label: t.sports.game.about,
              value: "about",
              content: <MarketAbout />,
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

interface MarketHeaderProps {
  title: string;
  volume: number;
}

function MarketHeader(props: MarketHeaderProps) {
  const { t } = useTranslation();
  const formatVolume = (volume: number) => {
    if (volume >= 1_000_000) {
      return (volume / 1_000_000).toFixed(1).replace(/\.0$/, "") + "m";
    } else if (volume >= 1_000) {
      return (volume / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
    } else {
      return volume.toString();
    }
  };
  return (
    <div>
      <div className="font-semibold">{props.title}</div>
      <div className="mt-1 text-sm text-(--text-secondary)">
        ${formatVolume(props.volume)} {t.sports.game.vol}.
      </div>
    </div>
  );
}

interface OutcomeGridProps {
  outcomes: Outcome[];
}

function OutcomeGrid(props: OutcomeGridProps) {
  return (
    <div className="flex gap-2">
      {props.outcomes.map((outcome) => (
        <GameButton
          key={outcome.id}
          color={outcome.label === "PAT" ? "#D62E20" : "#1A2C81"}
          className="flex-1"
        >
          <div className="flex items-center gap-1 px-4 justify-center">
            <div className="opacity-70">{outcome.label}</div>
            <div>{(outcome.price * 100).toFixed(0)}¢</div>
          </div>
        </GameButton>
      ))}
    </div>
  );
}

interface LineSelectorProps {
  lines: Line[];
}

function LineSelector(props: LineSelectorProps) {
  const [selectedLine, setSelectedLine] = useState<string>(props.lines[0].id);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [buttonWidths, setButtonWidths] = useState<number[]>([]);

  useEffect(() => {
    const widths = buttonRefs.current.map((ref) => ref?.offsetWidth || 0);
    setButtonWidths(widths);
  }, [props.lines]);

  const selectedIndex = props.lines.findIndex(
    (line) => line.id === selectedLine
  );
  const selectedCenter =
    selectedIndex >= 0
      ? buttonWidths.slice(0, selectedIndex).reduce((sum, w) => sum + w, 0) +
        buttonWidths[selectedIndex] / 2
      : 0;
  const offset = -selectedCenter;

  const handleBackClick = () => {
    const currentIndex = props.lines.findIndex(
      (line) => line.id === selectedLine
    );
    if (currentIndex > 0) {
      setSelectedLine(props.lines[currentIndex - 1].id);
    } else {
      // 循环到最后一个
      setSelectedLine(props.lines[props.lines.length - 1].id);
    }
  };

  const handleForwardClick = () => {
    const currentIndex = props.lines.findIndex(
      (line) => line.id === selectedLine
    );
    if (currentIndex < props.lines.length - 1) {
      setSelectedLine(props.lines[currentIndex + 1].id);
    } else {
      // 循环到第一个
      setSelectedLine(props.lines[0].id);
    }
  };

  return (
    <div className="border-t border-(--border)">
      <div className="relative top-[2px]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          className="absolute left-1/2 -translate-x-1/2 -top-1 text-text-brand z-1 text-blue"
        >
          <g fill="currentColor">
            <path
              d="m9.099,2.5H2.901c-.554,0-1.061.303-1.322.792-.262.488-.233,1.079.074,1.54l3.099,4.648c.279.418.745.668,1.248.668s.969-.25,1.248-.668l3.099-4.648c.308-.461.336-1.051.074-1.54-.262-.489-.769-.792-1.322-.792Z"
              stroke-width="0"
            ></path>
          </g>
        </svg>
      </div>

      <div className="flex items-center justify-between h-12 relative">
        <div className="bg-(--bg-primary) z-10 pl-2">
          <IconButton onClick={handleBackClick}>
            <ChevronLeft />
          </IconButton>
        </div>

        <div
          className="flex absolute left-1/2 transition-transform"
          style={{
            transform: `translateX(${offset}px)`,
          }}
        >
          {props.lines.map((line, index) => (
            <button
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              className={`h-full px-3 font-semibold ${
                selectedLine === line.id
                  ? "text-(--text-primary)"
                  : "text-(--text-secondary)"
              }`}
              key={line.id}
              onClick={() => setSelectedLine(line.id)}
            >
              {line.description}
            </button>
          ))}
        </div>
        <div className="bg-(--bg-primary) z-10 pr-2">
          <IconButton onClick={handleForwardClick}>
            <ChevronRightIcon />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
