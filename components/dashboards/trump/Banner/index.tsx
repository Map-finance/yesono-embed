import Image from "next/image";
import trumpAndCrew from "./trump-and-crew.webp";

export default function TrumpBanner() {
  return (
    <div className="relative px-8 h-[261px] rounded-lg overflow-hidden">
      <div className="absolute opacity-50 top-0 left-0 size-full [background:linear-gradient(to_right,rgba(255,107,101,0.4),rgba(41,126,255,0.4)),linear-gradient(to_bottom,rgba(255,255,255,0),rgba(255,255,255,0.6))] dark:[background:linear-gradient(to_right,rgb(255,107,101,0.4),rgb(41,126,255,0.4)),linear-gradient(to_bottom,rgb(29,43,57,0),rgb(29,43,57,1))]"></div>
      <div className="relative z-10 size-full flex items-center max-md:flex-col max-md:justify-between max-md:pt-4">
        <div>
          <div className="text-3xl font-semibold whitespace-nowrap">Trump won, now what?</div>
          <div className="w-16 h-1 bg-red mt-1"></div>
        </div>
        <Image src={trumpAndCrew} alt="Trump and crew" />
      </div>
    </div>
  );
}
