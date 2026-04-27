// 交易记录相关的类型定义和枚举

// 交易记录状态枚举
export enum TransactionStatus {
	PENDING = "PENDING",
	SUCCESS = "SUCCESS", 
	FAIL = "FAIL"
}

// 交易记录类型枚举
export enum TransactionType {
	STAKE = "stake",
	CLAIM = "claim"
}

// 交易记录接口
export interface TransactionRecord {
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
}

// 状态和类型的工具函数
export const getStatusText = (status: TransactionStatus): string => {
	switch (status) {
		case TransactionStatus.SUCCESS: return "成功";
		case TransactionStatus.PENDING: return "处理中";
		case TransactionStatus.FAIL: return "失败";
		default: return status;
	}
};

export const getTypeText = (type: TransactionType): string => {
	switch (type) {
		case TransactionType.STAKE: return "投注";
		case TransactionType.CLAIM: return "领取";
		default: return type;
	}
};
