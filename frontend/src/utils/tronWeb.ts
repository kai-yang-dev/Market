// TronWeb utility for frontend wallet operations
// Note: For Tron, users typically use TronLink extension, not MetaMask
// But we'll support both TronLink and direct TronWeb usage

declare global {
  interface Window {
    tronWeb?: any;
    tronLink?: any;
  }
}

export const USDT_CONTRACT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // USDT TRC20 mainnet

/**
 * Check if TronLink is installed
 */
export function isTronLinkInstalled(): boolean {
  return typeof window !== 'undefined' && (!!window.tronWeb || !!window.tronLink);
}

/**
 * Connect to TronLink wallet
 */
export async function connectTronLink(): Promise<string> {
  if (!isTronLinkInstalled()) {
    throw new Error('TronLink is not installed. Please install TronLink extension.');
  }

  try {
    // Request account access
    if (window.tronLink) {
      await window.tronLink.request({ method: 'tron_requestAccounts' });
    }

    console.log('window.tronLink', window.tronLink);

    // Wait for tronWeb to be available
    let attempts = 0;
    while (!window.tronWeb || !window.tronWeb.ready) {
      if (attempts++ > 20) {
        throw new Error('TronLink connection timeout');
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!window.tronWeb.defaultAddress || !window.tronWeb.defaultAddress.base58) {
      throw new Error('No Tron account found. Please unlock TronLink.');
    }

    return window.tronWeb.defaultAddress.base58;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to connect to TronLink');
  }
}

/**
 * Get current connected address
 */
export function getCurrentAddress(): string | null {
  if (!window.tronWeb || !window.tronWeb.defaultAddress) {
    return null;
  }
  return window.tronWeb.defaultAddress.base58;
}

/**
 * Transfer USDT TRC20 tokens
 */
export async function transferUSDT(
  toAddress: string,
  amount: number,
): Promise<string> {
  if (!window.tronWeb || !window.tronWeb.ready) {
    throw new Error('TronLink is not connected');
  }

  try {
    const contract = await window.tronWeb.contract().at(USDT_CONTRACT_ADDRESS);
    
    // Convert amount to smallest unit (USDT TRC20 has 6 decimals)
    // Use string to avoid precision issues
    const amountInSmallestUnit = window.tronWeb.toBigNumber((amount * 1000000).toString());
    
    // Transfer
    const tx = await contract.transfer(toAddress, amountInSmallestUnit).send();
    
    return tx;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to transfer USDT');
  }
}

/**
 * Get USDT balance for an address
 */
export async function getUSDTBalance(address: string): Promise<number> {
  if (!window.tronWeb || !window.tronWeb.ready) {
    throw new Error('TronLink is not connected');
  }

  try {
    const contract = await window.tronWeb.contract().at(USDT_CONTRACT_ADDRESS);
    const balance = await contract.balanceOf(address).call();
    // USDT TRC20 has 6 decimals
    // Convert BigNumber to number properly
    if (balance && typeof balance.toNumber === 'function') {
      return balance.toNumber() / 1000000;
    } else if (balance && typeof balance.dividedBy === 'function') {
      return balance.dividedBy(1000000).toNumber();
    } else if (typeof balance === 'bigint') {
      return Number(balance) / 1000000;
    } else {
      return Number(balance) / 1000000;
    }
  } catch (error: any) {
    throw new Error(error.message || 'Failed to get USDT balance');
  }
}

/**
 * Listen for account changes
 */
export function onAccountChange(callback: (address: string | null) => void): () => void {
  const interval = setInterval(() => {
    const address = getCurrentAddress();
    callback(address);
  }, 1000);

  return () => clearInterval(interval);
}

