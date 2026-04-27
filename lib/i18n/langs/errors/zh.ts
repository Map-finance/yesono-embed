export default {
    userRejected: '你已取消操作',
    insufficientFunds: '余额不足，请检查可用余额后重试',
    insufficientAllowance: '授权不足，请先完成授权后重试',
    networkMismatch: '网络不匹配，请切换到正确的链后重试',
    gasEstimationFailed: '交易可能会失败（Gas 估算失败）。请稍后重试，或降低金额/重新选择后再试',
    transactionFailedWithCode: (code: string) => `交易失败（${code}）。请稍后重试；若持续失败请联系管理员`,
    networkBusy: '网络繁忙或节点异常，请稍后重试',
    fallbackError: '操作失败，请稍后重试',
    contractRejected: (reason: string) => `合约拒绝该操作：${reason}`,
    contractExecutionFailed: (reason: string) => `合约执行失败：${reason}`,
    actionFailed: (action: string, msg: string) => `${action}失败：${msg}`
};
