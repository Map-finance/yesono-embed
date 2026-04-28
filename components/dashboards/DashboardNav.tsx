"use client";

import { AudioLines, BarChartBig, Radio, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo, useMemo } from "react";
import { useTranslation } from "@/lib/i18n";

function EarchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      className="lucide lucide-earth-icon lucide-earth"
    >
      <path d="M21.54 15H17a2 2 0 0 0-2 2v4.54" />
      <path d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17" />
      <path d="M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

function Volleyball() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      className="lucide lucide-volleyball-icon lucide-volleyball"
    >
      <path d="M11.1 7.1a16.55 16.55 0 0 1 10.9 4" />
      <path d="M12 12a12.6 12.6 0 0 1-8.7 5" />
      <path d="M16.8 13.6a16.55 16.55 0 0 1-9 7.5" />
      <path d="M20.7 17a12.8 12.8 0 0 0-8.7-5 13.3 13.3 0 0 1 0-10" />
      <path d="M6.3 3.8a16.55 16.55 0 0 0 1.9 11.5" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

export default function DashboardNav() {
  const { t } = useTranslation();
  const menus = [
    { path: "/dashboards/global-elections", name: t.dashboards.nav.elections, icon: <UsersRound /> },
    { path: "/dashboards/macro", name: t.dashboards.nav.macro, icon: <EarchIcon /> },
    { path: "/dashboards/sports", name: t.dashboards.nav.sports, icon: <Volleyball /> },
    { path: "/dashboards/fed-rates", name: t.dashboards.nav.fedRates, icon: <BarChartBig /> },
    { path: "/dashboards/trump", name: t.dashboards.nav.trump, icon: <AudioLines /> },
  ];

  return (
    <div className="flex flex-col gap-4 max-md:flex-row">
      <div>
        <h3 className="px-3 py-1.5 text-[10px] font-semibold text-(--text-tertiary) uppercase tracking-wide flex items-center gap-1 m-0 max-md:hidden">
          {t.dashboards.nav.title}
        </h3>
        <ul className="flex flex-col gap-1 list-none p-0 mt-4 max-md:mt-0 max-md:flex-row">
          {menus.map((menu) => (
            <MenuLink key={menu.path} path={menu.path} name={menu.name} icon={menu.icon} />
          ))}
        </ul>
      </div>
    </div>
  );
}

type MenuLinkProps = {
  path: string;
  name: string;
  icon: React.ReactNode;
};

export const MenuLink = memo(function MenuLink({
  path,
  name,
  icon,
}: MenuLinkProps) {
  const pathname = usePathname();

  const newPath = path === '/dashboards/sports' ? '/dashboards/sports/nfl' : path;

  const active = useMemo(() => {
    return pathname?.startsWith(path);
  }, [pathname, path]);
  return (
    <li>
      <Link
        href={newPath}
        className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-all max-md:flex-col ${
          active
            ? "bg-(--bg-secondary) text-(--accent)"
            : "hover:bg-(--bg-hover)"
        }`}
      >
        <span className="size-5 flex items-center justify-center">{icon}</span>
        <span className="whitespace-nowrap">{name}</span>
      </Link>
    </li>
  );
});
