import { Market, Game } from '@/types/types';
import { NavSportsProps } from '@/components/sports/Nav';

export const mockSportsNav: NavSportsProps['sports'] = [
  { name: 'NFL', id: 'nfl', count: 34, category: 'Football', categoryIcon: '🏈', isHot: true, logo: '🏈' },
  { name: 'CFB', id: 'cfb', count: 16, category: 'Football', categoryIcon: '🏈', isHot: false, logo: '📚' },
  { name: 'NBA', id: 'nba', count: 50, category: 'Basketball', categoryIcon: '🏀', isHot: true, logo: '🏀' },
  { name: 'WNBA', id: 'wnba', count: 8, category: 'Basketball', categoryIcon: '🏀', isHot: false, logo: '🏆' },
  { name: 'NCAA CBB', id: 'ncaa-cbb', count: 22, category: 'Basketball', categoryIcon: '🏀', isHot: false, logo: '🎖️' },
  { name: 'NHL', id: 'nhl', count: 199, category: 'Hockey', categoryIcon: '🏒', isHot: true, logo: '🏒' },
  { name: 'Hockey', id: 'hockey', count: 67, category: 'Hockey', categoryIcon: '🏒', isHot: false, logo: '🥅' },
  { name: 'UFC', id: 'ufc', count: 1, category: 'Combat', categoryIcon: '🥊', isHot: true, logo: '🥊' },
  { name: 'Soccer', id: 'soccer', count: 45, category: 'Soccer', categoryIcon: '⚽', isHot: false, logo: '⚽' },
  { name: 'Asian', id: 'soccer-asian', count: 0, category: 'Soccer', categoryIcon: '⚽', isHot: false, logo: '⚽' },
  { name: 'Esports', id: 'esports', count: 28, category: 'Esports', categoryIcon: '🎮', isHot: false, logo: '🎮' },
  { name: 'Cricket', id: 'cricket', count: 12, category: 'Cricket', categoryIcon: '🏏', isHot: false, logo: '🏏' },
];

export const mockGames: Game[] = [
  // NBA Games
  {
    id: 'nba-1',
    sport: 'NBA',
    status: 'LIVE',
    period: 'Q4',
    time: '02:15',
    volume: '1.21m',
    marketCount: 48,
    homeTeam: {
      seed: 1,
      logo: 'https://img.logo.dev/lakers.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Lakers',
      record: '18-10',
      primaryColor: '#552583'
    },
    awayTeam: {
      seed: 2,
      logo: 'https://img.logo.dev/giants.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Magic',
      record: '16-12',
      primaryColor: '#0172B4'
    },
    markets: [
      {
        id: 'nba-1-moneyline',
        type: 'moneyline',
        name: '胜负盘',
        options: [
          { team: 'away', label: 'Magic', odds: '91¢', value: 'away-win' },
          { team: 'home', label: 'Lakers', odds: '9¢', value: 'home-win' }
        ]
      },
      {
        id: 'nba-1-total',
        type: 'total',
        name: '总分盘',
        options: [
          { team: 'away', label: 'O 215.5', odds: '24¢', value: 'over' },
          { team: 'home', label: 'U 215.5', odds: '76¢', value: 'under' }
        ]
      }
    ]
  },
  {
    id: 'nba-2',
    sport: 'NBA',
    status: 'LIVE',
    period: 'Q3',
    time: '08:42',
    volume: '956k',
    marketCount: 42,
    homeTeam: {
      seed: 3,
      logo: 'https://img.logo.dev/celtics.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Celtics',
      record: '20-8',
      primaryColor: '#007A33'
    },
    awayTeam: {
      seed: 5,
      logo: 'https://img.logo.dev/heat.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Heat',
      record: '14-14',
      primaryColor: '#98002E'
    },
    markets: [
      {
        id: 'nba-2-moneyline',
        type: 'moneyline',
        name: '胜负盘',
        options: [
          { team: 'away', label: 'Heat', odds: '34¢', value: 'away-win' },
          { team: 'home', label: 'Celtics', odds: '66¢', value: 'home-win' }
        ]
      },
      {
        id: 'nba-2-spread',
        type: 'spread',
        name: '让分盘',
        options: [
          { team: 'away', label: '+4.5', odds: '48¢', value: 'away-spread' },
          { team: 'home', label: '-4.5', odds: '52¢', value: 'home-spread' }
        ]
      },
      {
        id: 'nba-2-total',
        type: 'total',
        name: '总分盘',
        options: [
          { team: 'away', label: 'O 215.5', odds: '52¢', value: 'over' },
          { team: 'home', label: 'U 215.5', odds: '48¢', value: 'under' }
        ]
      }
    ]
  },
  {
    id: 'nba-3',
    sport: 'NBA',
    status: 'LIVE',
    period: 'Q2',
    time: '05:23',
    volume: '2.1m',
    marketCount: 55,
    homeTeam: {
      seed: 2,
      logo: 'https://img.logo.dev/warriors.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Warriors',
      record: '17-11',
      primaryColor: '#1D428A'
    },
    awayTeam: {
      seed: 4,
      logo: 'https://img.logo.dev/nuggets.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Nuggets',
      record: '15-13',
      primaryColor: '#0E2240'
    },
    markets: [
      {
        id: 'nba-3-moneyline',
        type: 'moneyline',
        name: '胜负盘',
        options: [
          { team: 'away', label: 'Nuggets', odds: '55¢', value: 'away-win' },
          { team: 'home', label: 'Warriors', odds: '45¢', value: 'home-win' }
        ]
      },
      {
        id: 'nba-3-spread',
        type: 'spread',
        name: '让分盘',
        options: [
          { team: 'away', label: '+2.5', odds: '50¢', value: 'away-spread' },
          { team: 'home', label: '-2.5', odds: '50¢', value: 'home-spread' }
        ]
      },
      {
        id: 'nba-3-total',
        type: 'total',
        name: '总分盘',
        options: [
          { team: 'away', label: 'O 230.5', odds: '45¢', value: 'over' },
          { team: 'home', label: 'U 230.5', odds: '55¢', value: 'under' }
        ]
      }
    ]
  },
  // NFL Games
  {
    id: 'nfl-1',
    sport: 'NFL',
    status: 'LIVE',
    period: 'Q3',
    time: '11:24',
    volume: '3.5m',
    marketCount: 62,
    homeTeam: {
      seed: 1,
      logo: 'https://img.logo.dev/chiefs.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Chiefs',
      record: '11-3',
      primaryColor: '#E31837'
    },
    awayTeam: {
      seed: 5,
      logo: 'https://img.logo.dev/raiders.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Raiders',
      record: '5-9',
      primaryColor: '#000000'
    },
    markets: [
      {
        id: 'nfl-1-moneyline',
        type: 'moneyline',
        name: '胜负盘',
        options: [
          { team: 'away', label: 'Raiders', odds: '18¢', value: 'away-win' },
          { team: 'home', label: 'Chiefs', odds: '82¢', value: 'home-win' }
        ]
      },
      {
        id: 'nfl-1-spread',
        type: 'spread',
        name: '让分盘',
        options: [
          { team: 'away', label: '+9.5', odds: '45¢', value: 'away-spread' },
          { team: 'home', label: '-9.5', odds: '55¢', value: 'home-spread' }
        ]
      },
      {
        id: 'nfl-1-total',
        type: 'total',
        name: '总分盘',
        options: [
          { team: 'away', label: 'O 47.5', odds: '51¢', value: 'over' },
          { team: 'home', label: 'U 47.5', odds: '49¢', value: 'under' }
        ]
      }
    ]
  },
  {
    id: 'nfl-2',
    sport: 'NFL',
    status: 'LIVE',
    period: 'Q4',
    time: '07:18',
    volume: '2.8m',
    marketCount: 58,
    homeTeam: {
      seed: 2,
      logo: 'https://img.logo.dev/cowboys.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Cowboys',
      record: '9-5',
      primaryColor: '#041E42'
    },
    awayTeam: {
      seed: 3,
      logo: 'https://img.logo.dev/eagles.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Eagles',
      record: '10-4',
      primaryColor: '#004C54'
    },
    markets: [
      {
        id: 'nfl-2-moneyline',
        type: 'moneyline',
        name: '胜负盘',
        options: [
          { team: 'away', label: 'Eagles', odds: '65¢', value: 'away-win' },
          { team: 'home', label: 'Cowboys', odds: '35¢', value: 'home-win' }
        ]
      },
      {
        id: 'nfl-2-spread',
        type: 'spread',
        name: '让分盘',
        options: [
          { team: 'away', label: '-3.5', odds: '52¢', value: 'away-spread' },
          { team: 'home', label: '+3.5', odds: '48¢', value: 'home-spread' }
        ]
      },
      {
        id: 'nfl-2-total',
        type: 'total',
        name: '总分盘',
        options: [
          { team: 'away', label: 'O 51.5', odds: '48¢', value: 'over' },
          { team: 'home', label: 'U 51.5', odds: '52¢', value: 'under' }
        ]
      }
    ]
  },
  // NHL Games
  {
    id: 'nhl-1',
    sport: 'NHL',
    status: 'LIVE',
    period: 'P2',
    time: '14:32',
    volume: '687k',
    marketCount: 35,
    homeTeam: {
      seed: 1,
      logo: 'https://img.logo.dev/bruins.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Bruins',
      record: '22-8-3',
      primaryColor: '#FFB81C'
    },
    awayTeam: {
      seed: 4,
      logo: 'https://img.logo.dev/canadiens.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Canadiens',
      record: '15-15-3',
      primaryColor: '#AF1E2D'
    },
    markets: [
      {
        id: 'nhl-1-moneyline',
        type: 'moneyline',
        name: '胜负盘',
        options: [
          { team: 'away', label: 'Canadiens', odds: '38¢', value: 'away-win' },
          { team: 'home', label: 'Bruins', odds: '62¢', value: 'home-win' }
        ]
      },
      {
        id: 'nhl-1-spread',
        type: 'spread',
        name: '让分盘',
        options: [
          { team: 'away', label: '+1.5', odds: '65¢', value: 'away-spread' },
          { team: 'home', label: '-1.5', odds: '35¢', value: 'home-spread' }
        ]
      },
      {
        id: 'nhl-1-total',
        type: 'total',
        name: '总分盘',
        options: [
          { team: 'away', label: 'O 6.5', odds: '44¢', value: 'over' },
          { team: 'home', label: 'U 6.5', odds: '56¢', value: 'under' }
        ]
      }
    ]
  }
];

export const mockStartingSoonGames: Game[] = [
  // NBA - Today
  {
    id: 'soon-nba-1',
    sport: 'NBA',
    status: 'SCHEDULED',
    period: '',
    startTime: '2:45 AM',
    startDate: 'Tue, December 24',
    volume: '845k',
    marketCount: 38,
    homeTeam: {
      seed: 4,
      logo: 'https://img.logo.dev/suns.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Suns',
      record: '15-13',
      primaryColor: '#1D1160'
    },
    awayTeam: {
      seed: 6,
      logo: 'https://img.logo.dev/pelicans.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Pelicans',
      record: '12-16',
      primaryColor: '#0C2340'
    },
    markets: [
      {
        id: 'soon-nba-1-moneyline',
        type: 'moneyline',
        name: '胜负盘',
        options: [
          { team: 'away', label: 'Pelicans', odds: '42¢', value: 'away-win' },
          { team: 'home', label: 'Suns', odds: '58¢', value: 'home-win' }
        ]
      },
      {
        id: 'soon-nba-1-spread',
        type: 'spread',
        name: '让分盘',
        options: [
          { team: 'away', label: '+5.5', odds: '50¢', value: 'away-spread' },
          { team: 'home', label: '-5.5', odds: '50¢', value: 'home-spread' }
        ]
      },
      {
        id: 'soon-nba-1-total',
        type: 'total',
        name: '总分盘',
        options: [
          { team: 'away', label: 'O 218.5', odds: '49¢', value: 'over' },
          { team: 'home', label: 'U 218.5', odds: '51¢', value: 'under' }
        ]
      }
    ]
  },
  {
    id: 'soon-nba-2',
    sport: 'NBA',
    status: 'SCHEDULED',
    period: '',
    startTime: '5:30 AM',
    startDate: 'Tue, December 24',
    volume: '1.1m',
    marketCount: 45,
    homeTeam: {
      seed: 2,
      logo: 'https://img.logo.dev/bucks.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Bucks',
      record: '19-9',
      primaryColor: '#00471B'
    },
    awayTeam: {
      seed: 7,
      logo: 'https://img.logo.dev/nets.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Nets',
      record: '11-17',
      primaryColor: '#000000'
    },
    markets: [
      {
        id: 'soon-nba-2-moneyline',
        type: 'moneyline',
        name: '胜负盘',
        options: [
          { team: 'away', label: 'Nets', odds: '28¢', value: 'away-win' },
          { team: 'home', label: 'Bucks', odds: '72¢', value: 'home-win' }
        ]
      },
      {
        id: 'soon-nba-2-spread',
        type: 'spread',
        name: '让分盘',
        options: [
          { team: 'away', label: '+8.5', odds: '48¢', value: 'away-spread' },
          { team: 'home', label: '-8.5', odds: '52¢', value: 'home-spread' }
        ]
      },
      {
        id: 'soon-nba-2-total',
        type: 'total',
        name: '总分盘',
        options: [
          { team: 'away', label: 'O 225.5', odds: '52¢', value: 'over' },
          { team: 'home', label: 'U 225.5', odds: '48¢', value: 'under' }
        ]
      }
    ]
  },
  {
    id: 'soon-nba-3',
    sport: 'NBA',
    status: 'SCHEDULED',
    period: '',
    startTime: '8:00 AM',
    startDate: 'Tue, December 24',
    volume: '923k',
    marketCount: 41,
    homeTeam: {
      seed: 5,
      logo: 'https://img.logo.dev/clippers.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Clippers',
      record: '16-12',
      primaryColor: '#C8102E'
    },
    awayTeam: {
      seed: 8,
      logo: 'https://img.logo.dev/mavericks.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Mavericks',
      record: '14-14',
      primaryColor: '#00538C'
    },
    markets: [
      {
        id: 'soon-nba-3-moneyline',
        type: 'moneyline',
        name: '胜负盘',
        options: [
          { team: 'away', label: 'Mavericks', odds: '48¢', value: 'away-win' },
          { team: 'home', label: 'Clippers', odds: '52¢', value: 'home-win' }
        ]
      },
      {
        id: 'soon-nba-3-spread',
        type: 'spread',
        name: '让分盘',
        options: [
          { team: 'away', label: '+2.5', odds: '51¢', value: 'away-spread' },
          { team: 'home', label: '-2.5', odds: '49¢', value: 'home-spread' }
        ]
      },
      {
        id: 'soon-nba-3-total',
        type: 'total',
        name: '总分盘',
        options: [
          { team: 'away', label: 'O 222.5', odds: '50¢', value: 'over' },
          { team: 'home', label: 'U 222.5', odds: '50¢', value: 'under' }
        ]
      }
    ]
  },
  // NFL - Tomorrow
  {
    id: 'soon-nfl-1',
    sport: 'NFL',
    status: 'SCHEDULED',
    period: '',
    startTime: '1:00 AM',
    startDate: 'Wed, December 25',
    volume: '2.2m',
    marketCount: 52,
    homeTeam: {
      seed: 1,
      logo: 'https://img.logo.dev/ravens.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Ravens',
      record: '11-3',
      primaryColor: '#241773'
    },
    awayTeam: {
      seed: 4,
      logo: 'https://img.logo.dev/texans.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Texans',
      record: '9-5',
      primaryColor: '#03202F'
    },
    markets: [
      {
        id: 'soon-nfl-1-moneyline',
        type: 'moneyline',
        name: '胜负盘',
        options: [
          { team: 'away', label: 'Texans', odds: '38¢', value: 'away-win' },
          { team: 'home', label: 'Ravens', odds: '62¢', value: 'home-win' }
        ]
      },
      {
        id: 'soon-nfl-1-spread',
        type: 'spread',
        name: '让分盘',
        options: [
          { team: 'away', label: '+6.5', odds: '49¢', value: 'away-spread' },
          { team: 'home', label: '-6.5', odds: '51¢', value: 'home-spread' }
        ]
      },
      {
        id: 'soon-nfl-1-total',
        type: 'total',
        name: '总分盘',
        options: [
          { team: 'away', label: 'O 44.5', odds: '51¢', value: 'over' },
          { team: 'home', label: 'U 44.5', odds: '49¢', value: 'under' }
        ]
      }
    ]
  },
  {
    id: 'soon-nfl-2',
    sport: 'NFL',
    status: 'SCHEDULED',
    period: '',
    startTime: '4:30 AM',
    startDate: 'Wed, December 25',
    volume: '3.1m',
    marketCount: 64,
    homeTeam: {
      seed: 2,
      logo: 'https://img.logo.dev/49ers.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: '49ers',
      record: '6-8',
      primaryColor: '#AA0000'
    },
    awayTeam: {
      seed: 3,
      logo: 'https://img.logo.dev/dolphins.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Dolphins',
      record: '6-8',
      primaryColor: '#008E97'
    },
    markets: [
      {
        id: 'soon-nfl-2-moneyline',
        type: 'moneyline',
        name: '胜负盘',
        options: [
          { team: 'away', label: 'Dolphins', odds: '44¢', value: 'away-win' },
          { team: 'home', label: '49ers', odds: '56¢', value: 'home-win' }
        ]
      },
      {
        id: 'soon-nfl-2-spread',
        type: 'spread',
        name: '让分盘',
        options: [
          { team: 'away', label: '+3.5', odds: '50¢', value: 'away-spread' },
          { team: 'home', label: '-3.5', odds: '50¢', value: 'home-spread' }
        ]
      },
      {
        id: 'soon-nfl-2-total',
        type: 'total',
        name: '总分盘',
        options: [
          { team: 'away', label: 'O 46.5', odds: '48¢', value: 'over' },
          { team: 'home', label: 'U 46.5', odds: '52¢', value: 'under' }
        ]
      }
    ]
  },
  // NHL - Tomorrow
  {
    id: 'soon-nhl-1',
    sport: 'NHL',
    status: 'SCHEDULED',
    period: '',
    startTime: '7:00 AM',
    startDate: 'Wed, December 25',
    volume: '512k',
    marketCount: 28,
    homeTeam: {
      seed: 2,
      logo: 'https://img.logo.dev/rangers.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Rangers',
      record: '18-10-2',
      primaryColor: '#0038A8'
    },
    awayTeam: {
      seed: 5,
      logo: 'https://img.logo.dev/flyers.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128',
      name: 'Flyers',
      record: '13-14-4',
      primaryColor: '#F74902'
    },
    markets: [
      {
        id: 'soon-nhl-1-moneyline',
        type: 'moneyline',
        name: '胜负盘',
        options: [
          { team: 'away', label: 'Flyers', odds: '36¢', value: 'away-win' },
          { team: 'home', label: 'Rangers', odds: '64¢', value: 'home-win' }
        ]
      },
      {
        id: 'soon-nhl-1-spread',
        type: 'spread',
        name: '让分盘',
        options: [
          { team: 'away', label: '+1.5', odds: '62¢', value: 'away-spread' },
          { team: 'home', label: '-1.5', odds: '38¢', value: 'home-spread' }
        ]
      },
      {
        id: 'soon-nhl-1-total',
        type: 'total',
        name: '总分盘',
        options: [
          { team: 'away', label: 'O 6.5', odds: '47¢', value: 'over' },
          { team: 'home', label: 'U 6.5', odds: '53¢', value: 'under' }
        ]
      }
    ]
  }
];

export const mockMarkets: Market[] = [
  {
    id: '1',
    icon: 'https://via.placeholder.com/40',
    title: 'Fed decision in January?',
    cardType: 'multi',
    options: [
      { label: '50+ bps decrease', percentage: 2, change: undefined },
      { label: '25 bps decrease', percentage: 19, change: undefined },
    ],
    date: 'January 25',
    volume: '47m',
    timeframe: 'Monthly',
  },
  {
    id: '2',
    icon: 'https://via.placeholder.com/40',
    title: 'Who will Trump nominate as Fed Chair?',
    cardType: 'multi',
    options: [
      { label: 'Kevin Hassett', percentage: 58, change: undefined },
      { label: 'Kevin Warsh', percentage: 20, change: undefined },
    ],
    date: 'December 1',
    volume: '70m',
  },
  {
    id: '3',
    icon: 'https://via.placeholder.com/40',
    title: 'Oh My God',
    cardType: 'vs',
    options: [
      { label: 'Oh My God', percentage: 21 },
      { label: 'JD Gaming', percentage: 79 },
    ],
    volume: '254k',
    isLive: true,
    liveLabel: 'LEAGUE OF LEGENDS',
  },
  {
    id: '4',
    icon: 'https://via.placeholder.com/40',
    title: 'Israel strikes Iran by March 31, 2026?',
    cardType: 'image',
    options: [
      { label: 'Yes', percentage: 26 },
    ],
    volume: '27k',
    timeframe: 'Monthly',
    circularBadge: { value: '26%', label: 'chance' },
  },
  {
    id: '5',
    icon: 'https://via.placeholder.com/40',
    title: 'Will Trump release more Epstein files by...?',
    cardType: 'multi',
    options: [
      { label: 'December 22', percentage: 15 },
      { label: 'December 26', percentage: 39 },
    ],
    volume: '220k',
  },
  {
    id: '6',
    icon: 'https://via.placeholder.com/40',
    title: 'Who will be named in newly released Epstein files?',
    cardType: 'multi',
    options: [
      { label: 'Ehud Barak', percentage: 35 },
      { label: 'Elon Musk', percentage: 15 },
    ],
    volume: '2m',
  },
  {
    id: '7',
    icon: 'https://via.placeholder.com/40',
    title: 'Super Bowl Champion 2026',
    cardType: 'multi',
    options: [
      { label: 'Los Angeles R', percentage: 16 },
      { label: 'Buffalo', percentage: 14 },
    ],
    volume: '630m',
  },
  {
    id: '8',
    icon: 'https://via.placeholder.com/40',
    title: 'Maduro out by...?',
    cardType: 'multi',
    options: [
      { label: 'December 31, 2025', percentage: 3 },
      { label: 'January 31, 2026', percentage: 15 },
    ],
    volume: '300m',
  },
  {
    id: '9',
    icon: 'https://via.placeholder.com/40',
    title: 'Elon Musk # tweets December 16 - December 23, 2025?',
    cardType: 'multi',
    options: [
      { label: '40-59', percentage: 1 },
      { label: '260-290', percentage: 1 },
    ],
    volume: '17m',
    timeframe: 'Weekly',
  },
  {
    id: '10',
    icon: 'https://via.placeholder.com/40',
    title: 'Epstein client list released in 2025?',
    cardType: 'image',
    options: [
      { label: 'Yes', percentage: 2 },
    ],
    volume: '625k',
    circularBadge: { value: '2%', label: 'chance' },
  },
  {
    id: '11',
    icon: 'https://via.placeholder.com/40',
    title: 'TikTok sale announced by...?',
    cardType: 'multi',
    options: [
      { label: 'December 31', percentage: 83 },
      { label: 'March 31', percentage: 96 },
    ],
    volume: '87m',
    timeframe: 'Monthly',
  },
  {
    id: '12',
    icon: 'https://via.placeholder.com/40',
    title: 'NFC West Winner',
    cardType: 'multi',
    options: [
      { label: 'Seattle', percentage: 54 },
      { label: 'Los Angeles R', percentage: 25 },
    ],
    volume: '32m',
  },
  {
    id: '13',
    icon: 'https://via.placeholder.com/40',
    title: 'Will Netflix close Warner Bros. acquisition by end...?',
    cardType: 'image',
    options: [
      { label: 'Yes', percentage: 28 },
    ],
    volume: '158k',
    circularBadge: { value: '28%', label: 'chance' },
  },
  {
    id: '14',
    icon: 'https://via.placeholder.com/40',
    title: '2026 FIFA World Cup Winner',
    cardType: 'multi',
    options: [
      { label: 'Spain', percentage: 15 },
      { label: 'England', percentage: 13 },
    ],
    volume: '33m',
  },
  {
    id: '15',
    icon: 'https://via.placeholder.com/40',
    title: 'How many gifts will Santa deliver in 2025?',
    cardType: 'multi',
    options: [
      { label: '>7.9B', percentage: 1 },
      { label: '7.9-8B', percentage: 1 },
    ],
    volume: '1m',
  },
  {
    id: '16',
    icon: 'https://via.placeholder.com/40',
    title: 'Brazil Presidential Election',
    cardType: 'multi',
    options: [
      { label: 'Luiz Inácio Lula da Silva', percentage: 47 },
      { label: 'Flávio Bolsonaro', percentage: 19 },
    ],
    volume: '88m',
  },
  {
    id: '17',
    icon: 'https://via.placeholder.com/40',
    title: 'US x Venezuela military engagement by...?',
    cardType: 'multi',
    options: [
      { label: 'December 23', percentage: 2 },
      { label: 'December 31', percentage: 6 },
    ],
    volume: '41m',
  },
  {
    id: '18',
    icon: 'https://via.placeholder.com/40',
    title: 'Lighter market cap (FDV) one day after launch?',
    cardType: 'multi',
    options: [
      { label: '>$1B', percentage: 86 },
      { label: '>$2B', percentage: 81 },
    ],
    volume: '33m',
  },
  {
    id: '19',
    icon: 'https://via.placeholder.com/40',
    title: 'Who will be the first to leave the Trump Cabinet?',
    cardType: 'multi',
    options: [
      { label: 'Kristi Noem', percentage: 21 },
      { label: 'Pam Bondi', percentage: 16 },
    ],
    volume: '306k',
    timeframe: 'Annual',
  },
  {
    id: '20',
    icon: 'https://via.placeholder.com/40',
    title: 'Thailand x Cambodia ceasefire by...?',
    cardType: 'multi',
    options: [
      { label: 'December 31', percentage: 32 },
      { label: 'January 31', percentage: 69 },
    ],
    volume: '672k',
  },
  // Tech 相关数据
  {
    id: '21',
    icon: 'https://via.placeholder.com/40',
    title: 'Apple releases Vision Pro 2 by end of 2026?',
    cardType: 'multi',
    options: [
      { label: 'Yes', percentage: 65 },
      { label: 'No', percentage: 35 },
    ],
    volume: '45m',
    timeframe: 'Annual',
  },
  {
    id: '22',
    icon: 'https://via.placeholder.com/40',
    title: 'Tesla launches unsupervised full self driving (FSD) by March 31?',
    cardType: 'image',
    options: [
      { label: 'Yes', percentage: 70 },
    ],
    volume: '120m',
    circularBadge: { value: '70%', label: 'chance' },
  },
  {
    id: '23',
    icon: 'https://via.placeholder.com/40',
    title: 'SpaceX IPO closing market cap above $1.2T?',
    cardType: 'multi',
    options: [
      { label: 'Yes', percentage: 53 },
      { label: 'No', percentage: 47 },
    ],
    volume: '89m',
  },
  {
    id: '24',
    icon: 'https://via.placeholder.com/40',
    title: 'OpenAI releases GPT-6 by end of 2026?',
    cardType: 'multi',
    options: [
      { label: 'Yes', percentage: 78 },
      { label: 'No', percentage: 22 },
    ],
    volume: '56m',
  },
  {
    id: '25',
    icon: 'https://via.placeholder.com/40',
    title: 'Google launches quantum computer commercially by 2027?',
    cardType: 'image',
    options: [
      { label: 'Yes', percentage: 42 },
    ],
    volume: '34m',
    circularBadge: { value: '42%', label: 'chance' },
  },
  {
    id: '26',
    icon: 'https://via.placeholder.com/40',
    title: 'Meta releases AR glasses to consumers by end of 2026?',
    cardType: 'multi',
    options: [
      { label: 'Yes', percentage: 58 },
      { label: 'No', percentage: 42 },
    ],
    volume: '67m',
  },
  {
    id: '27',
    icon: 'https://via.placeholder.com/40',
    title: 'Microsoft acquires another major AI company by June 2026?',
    cardType: 'multi',
    options: [
      { label: 'Yes', percentage: 45 },
      { label: 'No', percentage: 55 },
    ],
    volume: '52m',
  },
  {
    id: '28',
    icon: 'https://via.placeholder.com/40',
    title: 'NVIDIA stock price reaches $2000 by end of 2026?',
    cardType: 'multi',
    options: [
      { label: 'Yes', percentage: 62 },
      { label: 'No', percentage: 38 },
    ],
    volume: '145m',
  },
];

export async function fetchElectionData() {
  // mock function to simulate fetching election data, count 100
  const countryCodes = [
    "us",
    "cn",
    "jp",
    "de",
    "fr",
    "gb",
    "it",
    "br",
    "in",
    "ca",
    "au",
    "kr",
    "ru",
    "za",
    "mx",
    "es",
    "id",
    "tr",
    "sa",
    "ar",
    "nl",
    "ch",
    "se",
    "be",
    "pl",
    "th",
    "ng",
    "eg",
    "pk",
    "vn",
  ];
  const electionTypes = ["Presidential", "Parliamentary", "General", "Senate"];
  const candidateNames = [
    "Mamady Doumbouya",
    "Joe Biden",
    "Emmanuel Macron",
    "Fumio Kishida",
    "Olaf Scholz",
    "Rishi Sunak",
    "Luiz Inácio Lula",
    "Narendra Modi",
    "Justin Trudeau",
    "Anthony Albanese",
    "Yoon Suk-yeol",
    "Vladimir Putin",
    "Cyril Ramaphosa",
    "Andrés Obrador",
    "Pedro Sánchez",
    "Recep Erdoğan",
    "Mohammed bin Salman",
    "Jair Bolsonaro",
    "Mark Rutte",
    "Ursula von der Leyen",
  ];
  return new Array(100).fill(null).map((_, index) => {
    const code = countryCodes[index % countryCodes.length];
    // 4候选人
    // 生成4个候选人，胜率加起来不超过100
    let remain = 100;
    // 先随机选一个位置，分配小于1%的概率
    const lessThanOneIdx = Math.floor(Math.random() * 4);
    const rates = Array.from({ length: 4 }).map((_, i) => {
      if (i === lessThanOneIdx) {
        const val = +(Math.random() * 0.99).toFixed(2); // 0~0.99
        remain -= val;
        return val;
      }
      if (i === 3) return remain;
      const max = remain - (4 - i - 1);
      const val = Math.floor(Math.random() * (max + 1));
      remain -= val;
      return val;
    });
    // 洗牌，避免每次最后一个最大
    for (let i = rates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rates[i], rates[j]] = [rates[j], rates[i]];
    }
    const candidates = Array.from({ length: 4 }).map((__, i) => {
      const name = candidateNames[(index * 4 + i) % candidateNames.length];
      return {
        name,
        avatar: `https://robohash.org/${encodeURIComponent(name)}.png?size=48x48`,
        winRate: rates[i],
      };
    });
    // 生成真实的国家名和月份
    const countryNames = [
      'United States', 'China', 'Japan', 'Germany', 'France', 'United Kingdom', 'Italy', 'Brazil', 'India', 'Canada',
      'Australia', 'South Korea', 'Russia', 'South Africa', 'Mexico', 'Spain', 'Indonesia', 'Turkey', 'Saudi Arabia', 'Argentina',
      'Netherlands', 'Switzerland', 'Sweden', 'Belgium', 'Poland', 'Thailand', 'Nigeria', 'Egypt', 'Pakistan', 'Vietnam',
    ];
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const country = countryNames[index % countryNames.length];
    const monthIdx = index % 12;
    const day = ((index * 7) % 28) + 1;
    const electionType = electionTypes[index % electionTypes.length];
    return {
      id: index + 1,
      country,
      electionDate: `2024-${(monthIdx + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
      flagUrl: `https://cdn.jsdelivr.net/npm/svg-country-flags@1.2.10/png250px/${code}.png`,
      electionType,
      candidates,
      // 额外字段供卡片用
      month: months[monthIdx],
      day,
    };
  });
}