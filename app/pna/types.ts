import { TransactionStatus, TransactionType } from "@/types/transaction";

export interface OpenRecordType {
    key: string;
    serialNumber: string;
    league: string;
    event: string; // 赛事
    handicapType: string;
    handicap: string;
    homeTeamPool: string;
    awayTeamPool: string;
    setupFee: string; // 开盘费（USDT 人类可读格式）
    createTime: string;
    eventStatus: string; // 赛事状态
    matchResult: string; // 赛事结果 (比分)
}

// 添加交易记录的接口
export interface TransactionRecordType {
    key: string;
    id: string;
    anchorId: string;
    type: TransactionType;
    amount: string;
    status: TransactionStatus;
    createTime: string;
    transactionId: string;
    email?: string;
    address?: string;
    smartAccount?: string;
    avatarUrl?: string;
    marketId?: string;
    eventName?: string;
    direct?: string;
}

// 充转记录接口
export interface WalletTransactionType {
    key: string;
    blockNum: number;
    chain: string; // 链名称
    txn: string;
    logIndex: number;
    txnType: string; // 交易类型，转入 in 转出 out
    tokenAddr: string; // 代币合约地址
    from: string; // 转出地址
    to: string; // 转入地址
    amount: number; // 原始金额
    calculatedAmount: number; // 实际金额
    status: number;
    statusDesc: string; // AML状态
    createdAt: string;
    updatedAt: string;
    chainTimestamp: number; // 创建时间 时间戳兼容秒级和毫秒级
    userId: string;
}

// API 返回的交易记录接口
export interface ApiTransactionRecord {
    id: number;
    anchorId: string;
    marketId: number;
    optionId: number;
    userId: number;
    email: string;
    amount: number;
    txHash: string;
    address: string;
    chainTimestamp: number;
    status: string | null;
    type: string | null;
    createdAt: number;
    username: string | null;
    avatarUrl: string;
    smartAccount: string;
    eventName: string;
    option: optionItem;
}

export interface optionItem {
    eventId: string;
    imagePath: string | null;
    name: string;
    optionId: string;
}

// 新的选项接口（主队客队信息）
export interface ApiOption {
    id: string;
    code: string; // "1" 为主队，"2" 为客队
    name: string;
    imagePath: string;
    turnover: string;
    outcomeValue: string;
}

// 新的API订单详细数据接口
export interface ApiOrderDetail {
    eventId: string;
    marketId: string;
    anchorId: string;
    transactionHash: string;
    stakeAmount: string;
    claimableAmount: string;
    profitLoss: string;
    createdAt: string;
    txHash: string;
    mechanism: string;
    line: string;
    claimStatus: number;
    code: string;
    totalMarketTurnover?: string;
    option1Turnover?: string;
    option2Turnover?: string;
    ownSideStakeRatio?: string;
}

// 新的API订单主数据接口
export interface ApiOrderBookRecord {
    id: string;
    name: string;
    state: string;
    status: string;
    stateName: string | null;
    eventTime: string;
    imagePath: string;
    options: ApiOption[]; // 新增：主队客队选项数组
    totalStakeAmount: string;
    totalClaimableAmount: string;
    totalProfitLoss: string;
    totalMarketTurnover: string;
    option1Turnover: string;
    option2Turnover: string;
    ownSideStakeRatio: string;
    isClaimable: boolean;
    orderDetails: ApiOrderDetail[];
}

// 订单详细数据接口（用于展示）
export interface OrderDetailType {
    key: string;
    marketId: string;
    handicap: string;
    homeTeamPool: string;
    awayTeamPool: string;
    betAmount: string;
    profitLoss: string;
    availableAmount: string; // 新增：可领取金额
    createTime: string;
    transactionHash: string;
    mechanism: string;
    claimStatus: number;
    code: string;
    option1Turnover?: string;
    option2Turnover?: string;
    ownSideStakeRatio?: string;
    anchorId?: string;
}

// 添加订单簿的接口
export interface OrderBookType {
    key: string;
    serialNumber: string;
    league: string;
    match: string;
    matchTime: string;
    handicapType: string;
    status: string;
    result: string;
    profitLoss: string;
    availableAmount: string;
    operation: string;
    totalStakeAmount: string;
    isClaimable: boolean;
    code?: string; // 添加 code 属性
    marketId?: string; // 添加 marketId 属性
    eventId?: string; // 添加 eventId 属性
    anchorId?: string; // 添加 anchorId 属性
    option1Turnover?: string; // 主队池总额
    option2Turnover?: string; // 客队池总额
    ownSideStakeRatio?: string; // 自己在己方的占比
    children?: OrderDetailType[];
}
