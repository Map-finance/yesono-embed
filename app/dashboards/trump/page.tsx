"use client";

import TrumpBanner from "@/components/dashboards/trump/Banner";
import PromisesPoliciesCard from "@/components/dashboards/trump/PromisesPoliciesCard";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function TrumpPage() {
  const { t } = useTranslation();
  const mockMarkets = [
    {
      id: "1",
      icon: "https://img.logo.dev/lakers.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128",
      title: "Will Trump nominate Kevin Warsh as the next Fed chair?",
      percentage: 32,
      change: 3,
      isUp: true,
    },
    {
      id: "2",
      icon: "https://img.logo.dev/giants.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128",
      title: "Will Zelenskyy and Putin meet next in Russia?",
      percentage: 0,
      change: 0,
      isUp: true,
    },
    {
      id: "3",
      icon: "https://img.logo.dev/celtics.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128",
      title: "Nothing Ever Happens: World Leader Out Edition",
      percentage: 100,
      change: 0.9,
      isUp: true,
    },
    {
      id: "4",
      icon: "https://img.logo.dev/warriors.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128",
      title: "Will Trump announce Kevin Warsh as next Fed Chair in 2025?",
      percentage: 0,
      change: -0.1,
      isUp: false,
    },
    {
      id: "5",
      icon: "https://img.logo.dev/heat.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128",
      title: "Will Trump sell 0 Gold Cards in 2025?",
      percentage: 99,
      change: 0.6,
      isUp: true,
    },
    {
      id: "6",
      icon: "https://img.logo.dev/chiefs.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128",
      title: "Will Trump pardon Steve Bannon in 2025?",
      percentage: 0,
      change: -0.5,
      isUp: false,
    },
    {
      id: "7",
      icon: "https://img.logo.dev/raiders.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128",
      title: "Will China and US reach a new trade deal in 2025?",
      percentage: 12,
      change: 1.2,
      isUp: true,
    },
    {
      id: "8",
      icon: "https://img.logo.dev/cowboys.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128",
      title: "Will UK rejoin the EU by 2030?",
      percentage: 5,
      change: -0.3,
      isUp: false,
    },
    {
      id: "9",
      icon: "https://img.logo.dev/eagles.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128",
      title: "Will Trump return to Twitter in 2025?",
      percentage: 67,
      change: 2.5,
      isUp: true,
    },
    {
      id: "10",
      icon: "https://img.logo.dev/bruins.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128",
      title: "Will Trump launch a crypto token?",
      percentage: 8,
      change: 0.2,
      isUp: true,
    },
    {
      id: "11",
      icon: "https://img.logo.dev/canadiens.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128",
      title: "Will France hold a snap election in 2025?",
      percentage: 15,
      change: 0.7,
      isUp: true,
    },
    {
      id: "12",
      icon: "https://img.logo.dev/suns.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128",
      title: "Will Trump build more border wall in 2025?",
      percentage: 44,
      change: -1.1,
      isUp: false,
    },
    {
      id: "13",
      icon: "https://img.logo.dev/pelicans.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128",
      title: "Will Germany change its chancellor in 2025?",
      percentage: 21,
      change: 0.4,
      isUp: true,
    },
    {
      id: "14",
      icon: "https://img.logo.dev/bucks.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128",
      title: "Will Trump announce a new healthcare plan?",
      percentage: 27,
      change: 0.0,
      isUp: true,
    },
    {
      id: "15",
      icon: "https://img.logo.dev/nets.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128",
      title: "Will Australia sign a new defense pact with US?",
      percentage: 18,
      change: 0.8,
      isUp: true,
    },
    {
      id: "16",
      icon: "https://img.logo.dev/clippers.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128",
      title: "Will Trump visit Ukraine in 2025?",
      percentage: 3,
      change: -0.2,
      isUp: false,
    },
    {
      id: "17",
      icon: "https://img.logo.dev/mavericks.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128",
      title: "Will Japan host a US summit in 2025?",
      percentage: 11,
      change: 0.5,
      isUp: true,
    },
    {
      id: "18",
      icon: "https://img.logo.dev/ravens.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128",
      title: "Will Trump announce new oil drilling?",
      percentage: 36,
      change: 1.7,
      isUp: true,
    },
    {
      id: "19",
      icon: "https://img.logo.dev/texans.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128",
      title: "Will India and US sign a tech deal?",
      percentage: 23,
      change: 0.9,
      isUp: true,
    },
    {
      id: "20",
      icon: "https://img.logo.dev/49ers.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128",
      title: "Will Trump announce a new space force mission?",
      percentage: 41,
      change: 2.2,
      isUp: true,
    },
  ];
  return (
    <div>
      <TrumpBanner />
      <div className="flex justify-between items-center mt-8">
        <div>
          <h1 className="text-3xl font-semibold">{t.dashboards.trump.promisesPolicies}</h1>
          <p className="text-[--text-secondary] mt-2 max-md:hidden">
            {t.dashboards.trump.promisesSubtitle}
          </p>
        </div>
        <div className="bg-[--bg-secondary] pl-3 py-[5px] flex items-center rounded-sm cursor-pointer hover:bg-[--bg-hover] transition-colors max-md:hidden">
          <div className="font-semibold">{t.dashboards.trump.viewAll}</div>
          <ChevronRight />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mt-4 max-md:grid-cols-1">
        {mockMarkets.map((market) => (
          <PromisesPoliciesCard key={market.id} market={market} />
        ))}
      </div>
    </div>
  );
}
