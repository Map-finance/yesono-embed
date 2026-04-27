export default {
    userRejected: 'Operation cancelled',
    insufficientFunds: 'Insufficient balance. Please check your available balance and retry.',
    insufficientAllowance: 'Insufficient allowance. Please complete authorization and retry.',
    networkMismatch: 'Network mismatch. Please switch to the correct chain and retry.',
    gasEstimationFailed: 'The transaction may fail (Gas estimation failed). Please try again later, or reduce the amount/reselect before trying again.',
    transactionFailedWithCode: (code: string) => `Transaction failed (${code}). Please try again later; if it continues to fail, please contact the administrator.`,
    networkBusy: 'Network busy or node anomaly, please try again later.',
    fallbackError: 'Operation failed, please try again later.',
    contractRejected: (reason: string) => `Contract rejected the operation: ${reason}`,
    contractExecutionFailed: (reason: string) => `Contract execution failed: ${reason}`,
    actionFailed: (action: string, msg: string) => `${action} failed: ${msg}`
};
