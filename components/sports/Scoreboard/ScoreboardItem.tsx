import { ArrowDown, BookOpen, Radio, X } from "lucide-react";
import Image from "next/image";

export interface ScoreboardItemProps {
  isOpen?: boolean;
  isSelect?: boolean;
  time?: string;
  volume?: string;
  team1?: {
    name: string;
    logo: string;
    price: string;
  };
  team2?: {
    name: string;
    logo: string;
    price: string;
  };
}

export default function ScoreboardItem(props: ScoreboardItemProps) {
  return (
    <div className="text-sm font-semibold cursor-pointer flex group relative border-r border-(--border) whitespace-nowrap">
      <div className="flex flex-col gap-3 p-2">
        <div className="flex justify-between items-center gap-3">
          <div className="px-[5px] bg-(--bg-secondary) rounded-sm">{props.time || '5:00 PM'}</div>
          <div className="text-(--text-secondary)">{props.volume || '$126.03 Vol.'}</div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div style={{ fontSize: 0 }}>
                <Image
                  src={props.team1?.logo || "https://img.logo.dev/nfl.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128&retina=false&format=png&theme=light"}
                  width={24}
                  height={24}
                  alt=""
                />
              </div>
              <div>{props.team1?.name || 'WCA'}</div>
            </div>
            <div className="text-(--text-secondary)">{props.team1?.price || '63'}<span className="text-[10px]">¢</span></div>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div style={{ fontSize: 0 }}>
                <Image
                  src={props.team2?.logo || "https://img.logo.dev/49ers.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128&retina=false&format=png&theme=light"}
                  width={24}
                  height={24}
                  alt=""
                />
              </div>
              <div>{props.team2?.name || 'WCA'}</div>
            </div>
            <div className="text-(--text-secondary)">{props.team2?.price || '23'}<span className="text-[10px]">¢</span></div>
          </div>
        </div>
      </div>
      <div className={`flex flex-col bg-(--bg-secondary) justify-around overflow-hidden transition-all ${
        props.isSelect ? 'w-[40px] px-1' : 'w-0 group-hover:w-[40px] group-hover:px-1'
      }`}>
          <IconButton>
            {props.isOpen ? <X size={22} /> : <Radio size={22} />}
          </IconButton>
          <IconButton>
            {(props.isSelect) ? (
              <div className="relative flex items-center justify-center">
                <span className="absolute size-[10px] bg-red rounded-full animate-ping opacity-75"></span>
                <span className="relative size-[10px] bg-red rounded-full"></span>
              </div>
            ) : (
              <div className="size-[10px] bg-current rounded-full opacity-70"></div>
            )}
          </IconButton>
          <IconButton>
            <ArrowDown size={22} />
          </IconButton>
      </div>
    </div>
  );
}

function IconButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="hover:bg-(--bg-hover) px-1 rounded-sm flex items-center justify-center h-[22px]">
      {children}
    </button>
  )
}