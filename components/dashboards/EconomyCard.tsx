import ProbabilityGauge from "@/components/ui/charts/ProbabilityGauge";
import Image from "next/image";
import Link from "next/link";

export default function EconomyCard() {
  return (
    <Link href="/market/1">
      <div className="border border-(--border) px-4 py-6 hover:scale-[1.02] rounded-md transition-transform cursor-pointer">
        <div className="flex items-center gap-3">
          <Image
            src="https://img.logo.dev/nets.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128"
            width={64}
            height={64}
            alt=""
            className="size-[40px] rounded-md"
          />
          <div className="font-semibold">
            Supreme Court rules in favor of Trump&apos;s tariffs?
          </div>
        </div>
        <ProbabilityGauge value={75} />
      </div>
    </Link>
  );
}
