export default {
  // Time range
  timeRange: {
    pastDay: "Past Day",
    pastWeek: "Past Week",
    pastMonth: "Past Month",
    allTime: "All-Time",
  },

  // Profile stats
  profile: {
    joined: "Joined",
    views: "views",
    positionsValue: "Positions Value",
    modeYesNo: "Yes/No",
    modeAsianHandicap: "Asian Handicap",
    asianPositionsValue: "Total Position Value",
    asianSlipCount: "Slip Count",
    biggestWin: "Biggest Win",
    predictions: "Predictions",
    recharge: "Deposit",
    withdraw: "Withdraw",
  },

  // Tabs
  tabs: {
    positions: "Positions",
    activity: "Activity",
    asianHandicapOrders: "Asian Handicap Orders",
    openOrders: "Open Orders",
    marketCreation: "Creation Records",
    marketAudit: "Audit Records",
    marketRecords: "Market Records",
    depositWithdrawHistory: "Deposit/Withdraw History",
  },

  // Audit records
  auditRecords: {
    event: "Event / Markets",
    status: "Status",
    createdAt: "Submitted",
    action: "Action",
    create: "Create",
    edit: "Edit",
    pendingHint: "Awaiting review",
    total: "Total",
    noRecords: "No audit records",
  },

  // Market creation records
  marketCreation: {
    market: "Market",
    status: "Status",
    createdAt: "Created",
    txHash: "Tx Hash",
    action: "Action",
    continueCreate: "Continue Create",
    retry: "Retry",
    total: "Total",
    noRecords: "No market creation records",
    recreate: "Recreate",
    viewMarket: "View",
  },

  // Position filters
  positionFilters: {
    active: "Active",
    closed: "Closed",
    searchPlaceholder: "Search positions",
  },

  // Sort options
  sort: {
    value: "Value",
    profitLossDollar: "Profit/Loss $",
    profitLossPercent: "Profit/Loss %",
    bet: "Bet",
    alphabetically: "Alphabetically",
    averagePrice: "Average Price",
    currentPrice: "Current Price",
  },

  // Position table headers
  positionHeaders: {
    market: "Market",
    outcome: "Outcome",
    bet: "Bet",
    shares: "shares",
    avg: "Avg",
    current: "Current",
    value: "Value",
    profitLoss: "Profit/Loss",
  },

  // Activity table
  activity: {
    type: "Type",
    market: "Market",
    amount: "Amount",
    shares: "Shares",
    buy: "Buy",
    sell: "Sell",
    merge: "Merge",
    redeem: "Redeem",
    deposit: "Deposit",
    withdraw: "Withdraw",
    transactionHistory: "Trade History ",
    chainTransactionHistory: "Chain History ",
  },

  // Time ago
  time: {
    minutesAgo: "minutes ago",
    hourAgo: "hour ago",
    hoursAgo: "hours ago",
    dayAgo: "day ago",
    daysAgo: "days ago",
  },

  // Positions
  positions: {
    claim: "Claim",
    claiming: "Claiming...",
    claimSuccess: "Claim successful",
    claimFailed: "Claim failed",
  },

  // Loading and empty states
  loading: "Loading...",
  noPositions: "No positions found",
  noActivity: "No activity found",
  loadMore: "Load More",
  noMore: "No more data",
  profitLossLabel: "Profit/Loss",

  // Orders
  orders: {
    marketSide: "Market / Side",
    type: "Type",
    price: "Price",
    amount: "Amount",
    status: "Status",
    expiration: "Expiration",
    action: "Action",
    cancel: "Cancel",
    canceling: "Canceling...",
    noOrders: "No open orders",
    cancelSuccess: "Order canceled successfully",
    cancelFailed: "Failed to cancel order",
    alreadyExpired: "Order has already expired and cannot be canceled",
    // Order status
    open: "Open",
    filled: "Filled",
    canceled: "Canceled",
    pending: "Pending",
    untriggered: "Untriggered",
    expired: "Expired",
    expiresInSeconds: "in {{n}}s",
    expiresInMinutes: "in {{n}}m",
    expiresInHours: "in {{n}}h",
    expiresInDays: "in {{n}}d",
    untilCancelled: "GTC",
    // Order types
    limit: "Limit",
    market: "Market",
    stopLimit: "Stop Limit",
    stopMarket: "Stop Market",
    takeProfitLimit: "Take Profit Limit",
    takeProfitMarket: "Take Profit Market",
    shortTerm: "Short",
    longTerm: "Long",
    totalQuantity: "Total Quantity",
    cancelAll: "Cancel all",
    cancelingAll: "Canceling all orders...",
    cancelAllSuccess: "Successfully canceled {count} orders",
    cancelAllFailed: "Failed to cancel orders",
    noOrdersToCancel: "No open orders to cancel",
    searchPlaceholder: "Search",
  },

  /**
   * Withdraw modal (PNA)
   *
   * Notes:
   * - Component: `components/pna/WithdrawModal.tsx`
   * - Keep wording neutral and concise.
   */
  withdrawModal: {
    title: "Withdraw",
    toAddressLabel: "Recipient address",
    toAddressPlaceholder: "0x...",
    amountLabel: "Amount (USDT)",
    amountPlaceholder: "0.00",
    targetChainLabel: "Network",
    noAvailableChains: "No available networks",
    confirmWithdraw: "Confirm withdraw",
  },
};
