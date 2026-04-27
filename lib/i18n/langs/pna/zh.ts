export default {
  // Time range
  timeRange: {
    pastDay: "过去一天",
    pastWeek: "过去一周",
    pastMonth: "过去一月",
    allTime: "全部时间",
  },

  // Profile stats
  profile: {
    joined: "加入于",
    views: "浏览量",
    positionsValue: "持仓价值",
    modeYesNo: "Yes/No",
    modeAsianHandicap: "亚盘",
    asianPositionsValue: "持仓总额",
    asianSlipCount: "单数",
    biggestWin: "最大收益",
    predictions: "预测数",
    recharge: "充值",
    withdraw: "提现",
  },

  // Tabs
  tabs: {
    positions: "持仓",
    activity: "活动",
    asianHandicapOrders: "亚盘订单",
    openOrders: "未完成订单",
    marketCreation: "创建记录",
    marketAudit: "审核记录",
    marketRecords: "市场记录",
    depositWithdrawHistory: "充提记录",
  },

  // 审核记录
  auditRecords: {
    event: "事件 / 市场",
    status: "审核状态",
    createdAt: "提交时间",
    action: "操作",
    create: "创建",
    edit: "修改",
    pendingHint: "等待审核中",
    total: "共",
    noRecords: "暂无审核记录",
  },

  // 市场创建记录
  marketCreation: {
    market: "市场",
    status: "状态",
    createdAt: "创建时间",
    txHash: "交易哈希",
    action: "操作",
    continueCreate: "继续创建",
    retry: "重试",
    total: "共",
    noRecords: "暂无市场创建记录",
    recreate: "重新创建",
    viewMarket: "查看",
  },

  // Position filters
  positionFilters: {
    active: "活跃",
    closed: "已关闭",
    searchPlaceholder: "搜索持仓",
  },

  // Sort options
  sort: {
    value: "价值",
    profitLossDollar: "盈亏 $",
    profitLossPercent: "盈亏 %",
    bet: "投注",
    alphabetically: "按字母顺序",
    averagePrice: "平均价格",
    currentPrice: "当前价格",
  },

  // Position table headers
  positionHeaders: {
    market: "市场",
    outcome: "结果",
    bet: "投注",
    shares: "份额",
    avg: "平均",
    current: "当前",
    value: "价值",
    profitLoss: "盈亏",
  },

  // Activity table
  activity: {
    type: "类型",
    market: "市场",
    amount: "金额",
    shares: "份额",
    buy: "买入",
    sell: "卖出",
    merge: "合并",
    redeem: "赎回",
    deposit: "充值",
    withdraw: "提现",
    transactionHistory: "交易记录",
    chainTransactionHistory: "链上交易记录",
  },

  // Time ago
  time: {
    minutesAgo: "分钟前",
    hourAgo: "小时前",
    hoursAgo: "小时前",
    dayAgo: "天前",
    daysAgo: "天前",
  },

  // Positions
  positions: {
    claim: "领取",
    claiming: "领取中...",
    claimSuccess: "领取成功",
    claimFailed: "领取失败",
  },

  // Loading and empty states
  loading: "加载中...",
  noPositions: "暂无持仓",
  noActivity: "暂无活动记录",
  loadMore: "加载更多",
  noMore: "没有更多数据",
  profitLossLabel: "盈亏",


  // Orders
  orders: {
    marketSide: "市场 / 方向",
    type: "类型",
    price: "价格",
    amount: "数量",
    status: "状态",
    expiration: "过期时间",
    action: "操作",
    cancel: "取消",
    canceling: "取消中...",
    noOrders: "暂无未完成订单",
    cancelSuccess: "订单取消成功",
    cancelFailed: "取消订单失败",
    alreadyExpired: "订单已过期，无法取消",
    // Order status
    open: "未完成",
    filled: "已成交",
    canceled: "已取消",
    pending: "待处理",
    untriggered: "未触发",
    expired: "已过期",
    expiresInSeconds: "{{n}} 秒后过期",
    expiresInMinutes: "{{n}} 分钟后过期",
    expiresInHours: "{{n}} 小时后过期",
    expiresInDays: "{{n}} 天后过期",
    untilCancelled: "GTC",
    // Order types
    limit: "限价",
    market: "市价",
    stopLimit: "止损限价",
    stopMarket: "止损市价",
    takeProfitLimit: "止盈限价",
    takeProfitMarket: "止盈市价",
    shortTerm: "短期",
    longTerm: "长期",
    totalQuantity: "预估总量",
    cancelAll: "全部取消",
    cancelingAll: "正在取消全部订单...",
    cancelAllSuccess: "成功取消了 {count} 个订单",
    cancelAllFailed: "取消订单失败",
    noOrdersToCancel: "没有可取消的未完成订单",
    searchPlaceholder: "搜索市场或结果",
  },

  /**
   * 提现弹窗（PNA）
   *
   * 中文注释：
   * - 该弹窗位于 `components/pna/WithdrawModal.tsx`
   * - 这里的文案尽量保持中性、简短，避免暴露底层实现细节
   */
  withdrawModal: {
    title: "提现",
    toAddressLabel: "目标地址",
    toAddressPlaceholder: "0x...",
    amountLabel: "金额 (USDT)",
    amountPlaceholder: "0.00",
    targetChainLabel: "目标链",
    noAvailableChains: "无可用链",
    confirmWithdraw: "确认提现",
  },
};
