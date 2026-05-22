export default {
  // Buy/Sell tabs
  buy: "买入",
  sell: "卖出",
  
  // Order types
  market: "市价",
  limit: "限价",
  
  // Actions
  more: "更多",
  merge: "合并",
  split: "拆分",
  trade: "交易",
  
  // Input labels
  amount: "金额",
  shares: "数量",
  limitPrice: "限价价格",
  
  // Quick amount buttons (buy)
  quickAdd1: "+$1",
  quickAdd20: "+$20",
  quickAdd100: "+$100",
  max: "最大",
  
  // Quick amount buttons (sell)
  percent25: "25%",
  percent50: "50%",
  
  // Win preview
  toWin: "可赢得",
  toWinTooltip: "若该结果获胜,你将获得的金额。每份额结算时兑付 $1。",
  avgPrice: "平均价格",

  // New additions
  setExpiration: "设置过期时间",
  total: "总计",
  youWillReceive: "预计收到",
  matching: "匹配中",
  estShares: "预计份额",
  estFee: "预计费用",
  time_5m: "5分钟",
  time_10m: "10分钟",
  time_30m: "30分钟",
  time_1h: "1小时",
  time_6h: "6小时",
  time_12h: "12小时",
  time_24h: "24小时",
  time_1d: "1天",
  "time_End of day": "交易日结束",

  // Split Shares
  splitShares: "拆分份额",
  splitDescription: "将 1 USDT 拆分为 {{yes}} 和 {{no}} 份额。您可以这样做来节省成本，即同时获得两者并仅出售另一方。",
  splitButton: "拆分份额",
  availableMax: "可用: {{amount}} USDT 最大",
  deposit: "充值",
  
  // Price format info
  price: "价格",
  american: "美式",
  decimal: "小数",
  
  // Merge shares dialog
  mergeShares: "合并份额",
  mergeDescription: "合并一份 {{yes}} 和一份 {{no}} 可获得 1 USDT。当你想要退出仓位时，这样做可以节省成本。",
  availableShares: "可用份额",
  unavailable: "不可用",
  restrictedMessage: "美国、法国或受限制地区的居民、企业或注册代理人无法进行交易。请参阅我们的使用条款。",
  
  // Split shares dialog
  splitMessage: "您必须拥有 USDT 才能拆分份额！",
  processing: "处理中...",
  invalidAmount: "请输入有效金额",

  // CTF Operation status
  statusMerging: "合并中...",
  statusSplitting: "拆分中...",
  statusRedeeming: "领取中...",
  statusRequestingMergePlan: "正在请求合并方案...",
  statusRequestingRedeemPlan: "正在请求领取方案...",
  statusCheckingBalance: "正在检查 YES/NO 余额...",
  statusCheckingMarketStatus: "正在检查市场状态...",
  statusBalanceZeroSwitchMerge: "余额为零，切换为直接合并...",
  statusBalanceZeroSwitchRedeem: "余额为零，切换为直接领取...",
  statusInsufficientBalancePrepareTopup: "余额不足，正在准备补足...",
  statusCheckingAvailableBalance: "正在检查可用余额...",
  statusSubmittingTopup: "正在提交补足交易...",
  statusWaitingForAssetBeforeMerge: "正在等待资产到账后合并...",
  statusWaitingForAsset: "正在等待资产到账...",
  statusSubmittingMerge: "正在提交合并交易...",
  statusSubmittingRedeem: "正在提交领取交易...",
  statusSubmittingAssetSync: "正在提交资产同步交易...",

  // Errors
  errorSelectOutcome: "请选择一个结果",
  errorInvalidAmount: "请输入有效金额",
  errorInvalidPrice: "请输入有效价格",
  "errorLimitMinShares": "限价单至少需要 5 份"
};
