/**
 * Web3工具函数
 */

/**
 * 检查是否为有效的以太坊地址
 */
export const isValidEthereumAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

/**
 * 检查是否为有效的以太坊交易哈希
 */
export const isValidTransactionHash = (hash: string): boolean => {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
};

/**
 * 格式化以太坊地址（隐藏中间部分）
 */
export const formatEthereumAddress = (address: string, start: number = 6, end: number = 4): string => {
  if (!isValidEthereumAddress(address)) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

/**
 * 格式化交易哈希（隐藏中间部分）
 */
export const formatTransactionHash = (hash: string, start: number = 6, end: number = 4): string => {
  if (!isValidTransactionHash(hash)) return hash;
  return `${hash.slice(0, start)}...${hash.slice(-end)}`;
};

/**
 * 将Wei转换为Ether
 */
export const weiToEther = (wei: string | number): string => {
  const weiNum = typeof wei === 'string' ? wei : wei.toString();
  const ether = parseFloat(weiNum) / Math.pow(10, 18);
  return ether.toFixed(18).replace(/\.?0+$/, '');
};

/**
 * 将Ether转换为Wei
 */
export const etherToWei = (ether: string | number): string => {
  const etherNum = typeof ether === 'string' ? parseFloat(ether) : ether;
  const wei = etherNum * Math.pow(10, 18);
  return wei.toString();
};

/**
 * 格式化以太币余额
 */
export const formatEtherBalance = (wei: string | number, decimals: number = 4): string => {
  const ether = weiToEther(wei);
  const num = parseFloat(ether);
  return num.toFixed(decimals);
};

/**
 * 格式化Gas价格
 */
export const formatGasPrice = (gasPrice: string | number): string => {
  const gasPriceNum = typeof gasPrice === 'string' ? parseInt(gasPrice) : gasPrice;
  const gwei = gasPriceNum / Math.pow(10, 9);
  return `${gwei.toFixed(2)} Gwei`;
};

/**
 * 计算Gas费用
 */
export const calculateGasFee = (gasPrice: string | number, gasLimit: string | number): string => {
  const gasPriceNum = typeof gasPrice === 'string' ? parseInt(gasPrice) : gasPrice;
  const gasLimitNum = typeof gasLimit === 'string' ? parseInt(gasLimit) : gasLimit;
  const totalWei = gasPriceNum * gasLimitNum;
  return weiToEther(totalWei);
};

/**
 * 检查网络ID
 */
export const getNetworkName = (chainId: number): string => {
  const networks: Record<number, string> = {
    // Ethereum
    1: 'Ethereum',
    3: 'Ropsten',
    4: 'Rinkeby',
    5: 'Goerli',
    42: 'Kovan',
    11155111: 'Sepolia',
    
    // Binance Smart Chain
    56: 'BSC',
    97: 'BSC Testnet',
    
    // Polygon
    137: 'Polygon',
    80001: 'Polygon Mumbai',
    
    // Arbitrum
    42161: 'Arbitrum',
    421611: 'Arbitrum Rinkeby',
    421614: 'Arbitrum Sepolia',
    
    // Optimism
    10: 'Optimism',
    69: 'Optimism Kovan',
    420: 'Optimism Goerli',
    11155420: 'Optimism Sepolia',
    
    // Avalanche
    43114: 'Avalanche',
    43113: 'Avalanche Fuji',
    
    // Fantom
    250: 'Fantom',
    4002: 'Fantom Testnet',
    
    // Base
    8453: 'Base',
    84531: 'Base Goerli',
    84532: 'Base Sepolia',
    
    // Solana
    101: 'Solana',
    102: 'Solana Testnet',
    103: 'Solana Devnet',
    
    // Tron
    728: 'Tron',
    
    // Other popular chains
    100: 'Gnosis',
    1284: 'Moonbeam',
    1285: 'Moonriver',
    1287: 'Moonbase Alpha',
    2000: 'Dogechain',
    9001: 'Evmos',
    10001: 'ETHW',
    10002: 'ETC',
  };
  return networks[chainId] || `Unknown Network (${chainId})`;
};

/**
 * 检查是否为测试网络
 */
export const isTestnet = (chainId: number): boolean => {
  const testnetIds = [3, 4, 5, 42, 97, 80001, 421611, 69, 43113, 4002, 84531];
  return testnetIds.includes(chainId);
};

/**
 * 检查是否为主网络
 */
export const isMainnet = (chainId: number): boolean => {
  const mainnetIds = [1, 56, 137, 42161, 10, 43114, 250, 8453];
  return mainnetIds.includes(chainId);
};

/**
 * 复制到剪贴板
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy text:', error);
    return false;
  }
};

/**
 * 防抖函数
 */
export const debounce = <T extends (...args: any[]) => any>(func: T, delay: number): T => {
  let timeoutId: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
};

/**
 * 节流函数
 */
export const throttle = <T extends (...args: any[]) => any>(func: T, delay: number): T => {
  let lastCall = 0;
  return ((...args: any[]) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  }) as T;
};
