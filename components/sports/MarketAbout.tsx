import { Link } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function MarketAbout() {
  const { t } = useTranslation();
  return (
    <div className="h-full overflow-auto scrollbar-hide p-4 flex flex-col gap-3">
      <p className="font-semibold">{t.sports.marketAbout.rules}</p>
      <p>
        This market will resolve to &quot;Invictus Gaming&quot; if Invictus Gaming win
        against Top Esports in the named LoL match in the Demacia Cup Playoffs,
        scheduled for December 26 at 4:00AM ET. This market will resolve to &quot;Top
        Esports&quot; if Top Esports win against Invictus Gaming in the LoL match. If
        the game is postponed, this market will remain open until the game has
        been completed. If the game is canceled entirely, with no make-up game,
        this market will resolve 50-50. The resolution source for this market
        will be official information from
        https://liquipedia.net/leagueoflegends/Main_Page.
      </p>
      <p>
        <span className="font-semibold">{t.sports.marketAbout.endDate}</span> Dec 26, 2025
      </p>
      <p>
        <span className="font-semibold">{t.sports.marketAbout.createdAt}</span> Dec 25, 2025, 10:30
        PM GMT+8
      </p>
      <p className="font-semibold">{t.sports.marketAbout.sources}</p>
      <div className="flex gap-4">
        <div className="flex gap-4 items-center border border-[--border] p-4 rounded-xl flex-1 shrink-0">
          <div className="bg-slate-700 size-10 rounded-full flex items-center justify-center">
            <Link size={16} />
          </div>
          <div className="flex-1 shrink-0">
            <div className="text-[--text-secondary]">{t.sports.marketAbout.resolutionSource}</div>
            <a className="mt-1 block text-sky-500 truncate" href="https://liquipedia.net/leagueoflegends/Main_Page">
              https://liquipedia.net/leagueofleg...
            </a>
          </div>
        </div>
        <div className="flex gap-4 items-center border border-[--border] p-4 rounded-xl flex-1 shrink-0">
          <div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              id="logo"
              viewBox="0 0 137 34.316"
              width="36px"
            >
              <path
                fill="#ff4a4a"
                d="M40.635,34.02H34.841a1.968,1.968,0,0,1-1.971-1.965V16.786L22.7,23.145a2.634,2.634,0,0,1-2.792,0L9.736,16.785v15.27A1.968,1.968,0,0,1,7.765,34.02H1.971A1.968,1.968,0,0,1,0,32.055V2.625A2.628,2.628,0,0,1,4.112.464L20.19,11.445a1.974,1.974,0,0,0,2.228,0L38.493.464a2.627,2.627,0,0,1,4.113,2.16V32.055a1.968,1.968,0,0,1-1.971,1.965"
                transform="translate(47.24 0.296)"
              ></path>
              <path
                fill="#ff4a4a"
                d="M38.511,34.054H2.615A2.612,2.612,0,0,1,0,31.444V1.957A1.959,1.959,0,0,1,1.961,0H7.728A1.959,1.959,0,0,1,9.689,1.957v22.43H31.437V1.957A1.958,1.958,0,0,1,33.4,0h5.767a1.959,1.959,0,0,1,1.961,1.957V31.445a2.612,2.612,0,0,1-2.615,2.609"
                transform="translate(0 0)"
              ></path>
              <path
                fill="#ff4a4a"
                d="M2.615,0h35.9a2.612,2.612,0,0,1,2.615,2.609V32.1a1.959,1.959,0,0,1-1.961,1.957H33.4A1.959,1.959,0,0,1,31.437,32.1V10.971a1.306,1.306,0,0,0-1.308-1.3H11a1.306,1.306,0,0,0-1.308,1.3V32.1a1.959,1.959,0,0,1-1.961,1.957H1.961A1.959,1.959,0,0,1,0,32.1V2.609A2.612,2.612,0,0,1,2.615,0"
                transform="translate(95.874 0)"
              ></path>
              <path
                fill="#ff4a4a"
                d="M0,1.943V7.749A1.953,1.953,0,0,0,1.963,9.692H7.729A1.953,1.953,0,0,0,9.692,7.749V1.943A1.953,1.953,0,0,0,7.729,0H1.963A1.953,1.953,0,0,0,0,1.943"
                transform="translate(111.591 15.979)"
              ></path>
            </svg>
          </div>
          <div className="flex-1 shrink-0">
            <div className="text-[--text-secondary]">{t.sports.marketAbout.resolver}</div>
            <a className="mt-1 block text-sky-500 truncate" href="https://explorer-mainnet.maticvigil.com/address/0x65070BE91477460D8A7AeEb94ef92fe056C2f2A7">
              0x65070BE91...
            </a>
          </div>
        </div>
      </div>
      <p className="font-semibold">{t.sports.marketAbout.resolution}</p>
      <div className="flex items-center justify-between">
        <a href="#" className="border border-[--border] px-3 py-1 rounded-full text-sm">{t.sports.marketAbout.proposeResolution}</a>
        <a href="#" className="flex items-center gap-2 text-[--text-secondary]">
          <div className="text-xs">{t.sports.marketAbout.viewDetails}</div>
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
            className="lucide lucide-square-arrow-out-up-right-icon lucide-square-arrow-out-up-right w-4"
          >
            <path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
            <path d="m21 3-9 9" />
            <path d="M15 3h6v6" />
          </svg>
        </a>
      </div>
    </div>
  );
}
