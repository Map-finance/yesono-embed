import React from "react";
import { MarketItem } from "../../types/crypto";
import { Bookmark, Gift } from "lucide-react";
import Link from "next/link";
import ProxyImage from "@/components/common/ProxyImage";
interface MarketCardProps {
  market: MarketItem;
}

const MarketCard: React.FC<MarketCardProps> = ({ market }) => {
  const getAssetIcon = (asset: string) => {
    const iconMap: Record<string, string> = {
      BTC: "https://cryptologos.cc/logos/bitcoin-btc-logo.png",
      ETH: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
      SOL: "https://cryptologos.cc/logos/solana-sol-logo.png",
      XRP: "https://cryptologos.cc/logos/xrp-xrp-logo.png",
      DOGE: "https://cryptologos.cc/logos/dogecoin-doge-logo.png",
    };

    return (
      iconMap[asset] || "https://cryptologos.cc/logos/polygon-matic-logo.png"
    );
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 flex flex-col h-full hover:border-[var(--accent)] transition-all cursor-pointer">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-[var(--bg-secondary)] flex items-center justify-center border border-[var(--border-light)]">
          <ProxyImage
            src={getAssetIcon(market.asset)}
            className="w-5 h-5 object-contain"
            alt={market.asset}
          />
        </div>
        <Link href={`/crypto/${market.id}`}>
          <h3 className="text-[15px] font-bold text-[var(--text-primary)] leading-snug flex-1 hover:text-[var(--accent)] transition-colors cursor-pointer">
            {market.question}
          </h3>
        </Link>
      </div>

      <div className="flex-1 space-y-2">
        {market.outcomes.map((outcome, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between group py-0.5"
          >
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[var(--text-tertiary)] text-xs">↑</span>
              <span className="text-[14px] text-[var(--text-secondary)] font-medium">
                {outcome.label}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[14px] font-bold text-[var(--text-primary)] w-12 text-right">
                {outcome.probability}
              </span>
              <div className="flex gap-1">
                <button className="px-3 py-1.5 bg-[#E7F7EF] text-[#00A854] rounded-lg text-[13px] font-bold hover:bg-[#00A854] hover:text-white transition-colors">
                  Yes
                </button>
                <button className="px-3 py-1.5 bg-[#FEEBEB] text-[#F5222D] rounded-lg text-[13px] font-bold hover:bg-[#F5222D] hover:text-white transition-colors">
                  No
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          {market.isLive && (
            <div className="flex items-center gap-1.5 mr-1">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
              <span className="text-[11px] font-black text-red-500 tracking-tighter uppercase">
                Live
              </span>
            </div>
          )}
          <span className="text-[12px] text-[var(--text-tertiary)] font-bold">
            {market.volume} Vol.
          </span>
        </div>
        <div className="flex items-center gap-3 text-[var(--text-tertiary)]">
          {market.hasGift && <Gift className="w-4 h-4" />}
          <Bookmark className="w-4 h-4 hover:text-[var(--accent)] transition-colors" />
        </div>
      </div>
    </div>
  );
};

export default MarketCard;
