"use client"
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import ScoreboardItem from "./ScoreboardItem";
import TimeDivision from "@/components/sports/Scoreboard/TimeDivision";

export default function Scoreboard() {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const mockData = [
    {
      date: new Date('2025-12-22T09:00:00'),
      volume: '$126.03 Vol.',
      team1: { name: 'Patriots', logo: 'https://img.logo.dev/patriots.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '63' },
      team2: { name: 'Bills', logo: 'https://img.logo.dev/buffalobills.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '37' },
      isSelect: true
    },
    {
      date: new Date('2025-12-22T09:30:00'),
      volume: '$89.52 Vol.',
      team1: { name: 'Packers', logo: 'https://img.logo.dev/packers.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '55' },
      team2: { name: 'Bears', logo: 'https://img.logo.dev/chicagobears.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '45' },
    },
    {
      date: new Date('2025-12-22T10:00:00'),
      volume: '$210.88 Vol.',
      team1: { name: 'Cowboys', logo: 'https://img.logo.dev/dallascowboys.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '72' },
      team2: { name: 'Giants', logo: 'https://img.logo.dev/giants.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '28' },
    },
    {
      date: new Date('2025-12-22T11:00:00'),
      volume: '$156.27 Vol.',
      team1: { name: '49ers', logo: 'https://img.logo.dev/49ers.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '68' },
      team2: { name: 'Seahawks', logo: 'https://img.logo.dev/seahawks.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '32' },
    },
    {
      date: new Date('2025-12-22T12:00:00'),
      volume: '$94.15 Vol.',
      team1: { name: 'Chiefs', logo: 'https://img.logo.dev/chiefs.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '81' },
      team2: { name: 'Raiders', logo: 'https://img.logo.dev/raiders.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '19' },
    },
    {
      date: new Date('2025-12-22T13:30:00'),
      volume: '$178.93 Vol.',
      team1: { name: 'Steelers', logo: 'https://img.logo.dev/steelers.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '59' },
      team2: { name: 'Ravens', logo: 'https://img.logo.dev/ravens.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '41' },
    },
    {
      date: new Date('2025-12-22T14:00:00'),
      volume: '$143.67 Vol.',
      team1: { name: 'Broncos', logo: 'https://img.logo.dev/denverbroncos.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '52' },
      team2: { name: 'Chargers', logo: 'https://img.logo.dev/chargers.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '48' },
    },
    {
      date: new Date('2025-12-22T15:15:00'),
      volume: '$198.45 Vol.',
      team1: { name: 'Eagles', logo: 'https://img.logo.dev/philadelphiaeagles.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '75' },
      team2: { name: 'Commanders', logo: 'https://img.logo.dev/commanders.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '25' },
    },
    {
      date: new Date('2025-12-22T16:30:00'),
      volume: '$112.34 Vol.',
      team1: { name: 'Vikings', logo: 'https://img.logo.dev/vikings.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '61' },
      team2: { name: 'Lions', logo: 'https://img.logo.dev/detroitlions.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '39' },
    },
    {
      date: new Date('2025-12-22T17:00:00'),
      volume: '$167.89 Vol.',
      team1: { name: 'Bengals', logo: 'https://img.logo.dev/bengals.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '67' },
      team2: { name: 'Browns', logo: 'https://img.logo.dev/clevelandbrowns.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '33' },
    },
    {
      date: new Date('2025-12-22T18:15:00'),
      volume: '$134.56 Vol.',
      team1: { name: 'Rams', logo: 'https://img.logo.dev/therams.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '58' },
      team2: { name: 'Cardinals', logo: 'https://img.logo.dev/azcardinals.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '42' },
    },
    {
      date: new Date('2025-12-22T19:30:00'),
      volume: '$189.23 Vol.',
      team1: { name: 'Dolphins', logo: 'https://img.logo.dev/miamidolphins.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '71' },
      team2: { name: 'Jets', logo: 'https://img.logo.dev/newyorkjets.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '29' },
    },
    {
      date: new Date('2025-12-22T20:00:00'),
      volume: '$145.78 Vol.',
      team1: { name: 'Colts', logo: 'https://img.logo.dev/colts.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '54' },
      team2: { name: 'Titans', logo: 'https://img.logo.dev/titansonline.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '46' },
    },
    {
      date: new Date('2025-12-22T21:15:00'),
      volume: '$176.91 Vol.',
      team1: { name: 'Jaguars', logo: 'https://img.logo.dev/jaguars.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '49' },
      team2: { name: 'Texans', logo: 'https://img.logo.dev/houstontexans.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '51' },
    },
    {
      date: new Date('2025-12-22T22:30:00'),
      volume: '$123.45 Vol.',
      team1: { name: 'Saints', logo: 'https://img.logo.dev/neworleanssaints.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '57' },
      team2: { name: 'Buccaneers', logo: 'https://img.logo.dev/buccaneers.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '43' },
    },
    {
      date: new Date('2025-12-23T08:00:00'),
      volume: '$201.67 Vol.',
      team1: { name: 'Falcons', logo: 'https://img.logo.dev/atlantafalcons.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '65' },
      team2: { name: 'Panthers', logo: 'https://img.logo.dev/panthers.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '35' },
    },
    {
      date: new Date('2025-12-23T09:15:00'),
      volume: '$158.32 Vol.',
      team1: { name: 'Lakers', logo: 'https://img.logo.dev/lakers.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '78' },
      team2: { name: 'Celtics', logo: 'https://img.logo.dev/celtics.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '22' },
    },
    {
      date: new Date('2025-12-23T10:30:00'),
      volume: '$187.54 Vol.',
      team1: { name: 'Warriors', logo: 'https://img.logo.dev/warriors.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '69' },
      team2: { name: 'Suns', logo: 'https://img.logo.dev/suns.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '31' },
    },
    {
      date: new Date('2025-12-23T11:00:00'),
      volume: '$139.28 Vol.',
      team1: { name: 'Nets', logo: 'https://img.logo.dev/nets.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '53' },
      team2: { name: 'Knicks', logo: 'https://img.logo.dev/nyknicks.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '47' },
    },
    {
      date: new Date('2025-12-23T12:15:00'),
      volume: '$172.46 Vol.',
      team1: { name: 'Heat', logo: 'https://img.logo.dev/heat.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '64' },
      team2: { name: 'Magic', logo: 'https://img.logo.dev/orlandomagic.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '36' },
    },
    {
      date: new Date('2025-12-23T13:30:00'),
      volume: '$114.89 Vol.',
      team1: { name: 'Bucks', logo: 'https://img.logo.dev/bucks.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '74' },
      team2: { name: 'Bulls', logo: 'https://img.logo.dev/bulls.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '26' },
    },
    {
      date: new Date('2025-12-23T14:45:00'),
      volume: '$195.73 Vol.',
      team1: { name: 'Nuggets', logo: 'https://img.logo.dev/nuggets.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '77' },
      team2: { name: 'Jazz', logo: 'https://img.logo.dev/utahjazz.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '23' },
    },
    {
      date: new Date('2025-12-23T16:00:00'),
      volume: '$162.15 Vol.',
      team1: { name: 'Clippers', logo: 'https://img.logo.dev/clippers.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '60' },
      team2: { name: 'Kings', logo: 'https://img.logo.dev/kings.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '40' },
    },
    {
      date: new Date('2025-12-23T17:15:00'),
      volume: '$148.92 Vol.',
      team1: { name: 'Mavericks', logo: 'https://img.logo.dev/mavs.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '70' },
      team2: { name: 'Rockets', logo: 'https://img.logo.dev/rockets.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '30' },
    },
    {
      date: new Date('2025-12-23T18:30:00'),
      volume: '$183.56 Vol.',
      team1: { name: 'Spurs', logo: 'https://img.logo.dev/spurs.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '56' },
      team2: { name: 'Pelicans', logo: 'https://img.logo.dev/pelicans.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '44' },
    },
    {
      date: new Date('2025-12-23T19:45:00'),
      volume: '$127.38 Vol.',
      team1: { name: 'Raptors', logo: 'https://img.logo.dev/raptors.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '62' },
      team2: { name: 'Pistons', logo: 'https://img.logo.dev/pistons.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '38' },
    },
    {
      date: new Date('2025-12-23T21:00:00'),
      volume: '$169.84 Vol.',
      team1: { name: 'Trail Blazers', logo: 'https://img.logo.dev/blazers.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '66' },
      team2: { name: 'Timberwolves', logo: 'https://img.logo.dev/timberwolves.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '34' },
    },
    {
      date: new Date('2025-12-23T22:15:00'),
      volume: '$191.27 Vol.',
      team1: { name: 'Grizzlies', logo: 'https://img.logo.dev/grizzlies.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '73' },
      team2: { name: 'Thunder', logo: 'https://img.logo.dev/thunder.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '27' },
    },
    {
      date: new Date('2025-12-23T23:30:00'),
      volume: '$135.61 Vol.',
      team1: { name: 'Hornets', logo: 'https://img.logo.dev/hornets.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '50' },
      team2: { name: 'Wizards', logo: 'https://img.logo.dev/wizards.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128', price: '50' },
    },
  ];
  
  // 渲染带日期分隔的项目
  const renderItems = () => {
    const items: JSX.Element[] = [];
    let lastDate: Date | null = null;
    
    mockData.forEach((item, idx) => {
      const currentDate = item.date;
      if (!currentDate) return; // 跳过没有日期的项
      
      const currentDateStr = currentDate.toDateString();
      const lastDateStr = lastDate?.toDateString();
      
      // 如果日期变化，插入TimeDivision
      if (lastDateStr !== currentDateStr) {
        items.push(
          <TimeDivision key={`date-${idx}`} time={currentDate} />
        );
      }
      
      // 添加比赛项
      items.push(
        <ScoreboardItem
          key={`item-${idx}`}
          time={currentDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          volume={item.volume}
          team1={item.team1}
          team2={item.team2}
          isSelect={item.isSelect}
        />
      );
      
      lastDate = currentDate;
    });
    
    return items;
  };
  
  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    
    const scrollAmount = scrollRef.current.clientWidth * 0.8;
    
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <div className="flex border-b border-(--border)">
      <div 
        className="bg-(--bg-secondary) flex items-center cursor-pointer px-1 hover:bg-(--bg-hover)"
        onClick={() => handleScroll('left')}
      >
        <ChevronLeft />
      </div>
      <div className="overflow-auto scrollbar-hide" ref={scrollRef}>
        <div className="flex">
          {renderItems()}
        </div>
      </div>
      <div 
        className="bg-(--bg-secondary) flex items-center cursor-pointer px-1 hover:bg-(--bg-hover)"
        onClick={() => handleScroll('right')}
      >
        <ChevronRight />
      </div>
    </div>
  );
}
