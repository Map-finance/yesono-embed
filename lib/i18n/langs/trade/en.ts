export default {
  // Buy/Sell tabs
  buy: "Buy",
  sell: "Sell",

  // Order types
  market: "Market",
  limit: "Limit",

  // Actions
  more: "More",
  merge: "Merge",
  split: "Split",
  trade: "Trade",

  // Input labels
  amount: "Amount",
  shares: "Shares",
  limitPrice: "Limit Price",

  // Quick amount buttons (buy)
  quickAdd1: "+$1",
  quickAdd20: "+$20",
  quickAdd100: "+$100",
  max: "Max",

  // Quick amount buttons (sell)
  percent25: "25%",
  percent50: "50%",

  // Win preview
  toWin: "To win",
  toWinTooltip: "The amount you'll receive if this outcome wins. Each share pays out $1 at settlement.",
  avgPrice: "Avg. Price",

  // New additions
  setExpiration: "Set Expiration",
  total: "Total",
  youWillReceive: "You'll receive",
  matching: "matching",
  estShares: "Est. Shares",
  estFee: "Est. Fee",
  time_5m: "5m",
  time_10m: "10m",
  time_30m: "30m",
  time_1h: "1h",
  time_6h: "6h",
  time_12h: "12h",
  time_24h: "24h",
  time_1d: "1d",
  "time_End of day": "End of day",

  // Split Shares
  splitShares: "Split Shares",
  splitDescription: "Split a USDT into a share of {{yes}} and {{no}}. You can do this to save cost by getting both and just selling the other side.",
  splitButton: "Split shares",
  availableMax: "Available: {{amount}} USDT Max",
  deposit: "Deposit",

  // Price format info
  price: "Price",
  american: "American",
  decimal: "Decimal",

  // Merge shares dialog
  mergeShares: "Merge shares",
  mergeDescription: "Merge a share of {{yes}} and {{no}} to get 1 USDT. You can do this to save cost when trying to get rid of a position.",
  availableShares: "Available shares",
  unavailable: "Unavailable",
  restrictedMessage: "Trading is not available to people or companies who are residents of, or are located, incorporated or have a registered agent in, the United States, France, or a restricted territory. See our Terms of Use.",

  // Split shares dialog
  splitMessage: "You must have USDT to split shares!",
  processing: "Processing...",
  invalidAmount: "Please enter a valid amount",

  // CTF Operation status
  statusMerging: "Merging tokens...",
  statusSplitting: "Splitting tokens...",
  statusRedeeming: "Redeeming tokens...",
  statusRequestingMergePlan: "Requesting merge plan from server...",
  statusRequestingRedeemPlan: "Requesting redeem plan from server...",
  statusCheckingBalance: "Checking YES/NO balance...",
  statusCheckingMarketStatus: "Checking market status...",
  statusBalanceZeroSwitchMerge: "Balance is zero, switching to direct merge...",
  statusBalanceZeroSwitchRedeem: "Balance is zero, switching to direct redeem...",
  statusInsufficientBalancePrepareTopup: "Insufficient balance, preparing top-up...",
  statusCheckingAvailableBalance: "Checking available balance...",
  statusSubmittingTopup: "Submitting top-up transaction...",
  statusWaitingForAssetBeforeMerge: "Waiting for asset arrival before merge...",
  statusWaitingForAsset: "Waiting for asset arrival...",
  statusSubmittingMerge: "Submitting merge transaction...",
  statusSubmittingRedeem: "Submitting redeem transaction...",
  statusSubmittingAssetSync: "Submitting asset sync transaction...",

  // Errors
  errorSelectOutcome: "Please select an outcome",
  errorInvalidAmount: "Enter a valid amount",
  errorInvalidPrice: "Enter a valid price",
  "errorLimitMinShares": "Limit order requires at least 5 shares"
};
