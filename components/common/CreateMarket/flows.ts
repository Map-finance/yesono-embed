import MarketConfiguration from "./MarketConfiguration";
import MarketQuestion from "./MarketQuestion";
import MarketDetails from "./MarketDetails";
// import MarketSettings from "./MarketSettings";
import MarketReview from "./MarketReview";
import MarketSuccess from "./MarketSuccess";
import { StepConfig } from "./types";
import CreateMarketSportsInfoForm from "@/components/common/CreateMarket/sports/InfoForm";
import HandicapForm from "./sports/HandicapForm";

// 通用市场流程
export const GENERAL_MARKET_FLOW: StepConfig[] = [
  { component: MarketConfiguration },
  { component: MarketQuestion },
  { component: MarketDetails },
  // { component: MarketSettings },
  { component: MarketReview },
  { component: MarketSuccess },
];

// 运动市场流程
export const SPORTS_MARKET_FLOW: StepConfig[] = [
  { component: MarketConfiguration },
  { component: CreateMarketSportsInfoForm },
  { component: HandicapForm },
  { component: MarketDetails },
  { component: MarketReview },
  { component: MarketSuccess },
];

// 根据市场类型获取流程配置
export function getMarketFlow(marketType: "general" | "sports"): StepConfig[] {
  switch (marketType) {
    case "sports":
      return SPORTS_MARKET_FLOW;
    case "general":
    default:
      return GENERAL_MARKET_FLOW;
  }
}
