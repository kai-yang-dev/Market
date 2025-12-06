import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { walletApi, Wallet } from '../../services/api';
import { connectTronLink, getCurrentAddress, getUSDTBalance } from '../../utils/tronWeb';
import { showToast } from '../../utils/toast';

interface WalletState {
  wallet: Wallet | null;
  isConnecting: boolean;
  balance: number | null;
  isConnected: boolean;
}

const initialState: WalletState = {
  wallet: null,
  isConnecting: false,
  balance: null,
  isConnected: false,
};

// Load wallet from API
export const fetchWallet = createAsyncThunk(
  'wallet/fetchWallet',
  async (_, { rejectWithValue }) => {
    try {
      const wallet = await walletApi.getMyWallet();
      if (wallet && wallet.walletAddress) {
        // Get balance from blockchain
        try {
          const balance = await getUSDTBalance(wallet.walletAddress);
          return { ...wallet, balance };
        } catch (error) {
          console.error('Failed to fetch balance:', error);
          return wallet;
        }
      }
      return null;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch wallet');
    }
  }
);

// Connect wallet
export const connectWallet = createAsyncThunk(
  'wallet/connectWallet',
  async (_, { rejectWithValue }) => {
    try {
      // Connect to TronLink
      const address = await connectTronLink();
      
      // Save to backend
      const wallet = await walletApi.connect(address);
      
      // Get balance
      const balance = await getUSDTBalance(address);
      
      showToast.success('Wallet connected successfully');
      return { ...wallet, balance };
    } catch (error: any) {
      showToast.error(error.message || 'Failed to connect wallet');
      return rejectWithValue(error.message || 'Failed to connect wallet');
    }
  }
);

// Refresh balance
export const refreshBalance = createAsyncThunk(
  'wallet/refreshBalance',
  async (walletAddress: string, { rejectWithValue }) => {
    try {
      const balance = await getUSDTBalance(walletAddress);
      return balance;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to refresh balance');
    }
  }
);

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    disconnectWallet: (state) => {
      state.wallet = null;
      state.balance = null;
      state.isConnected = false;
    },
    setBalance: (state, action: PayloadAction<number>) => {
      state.balance = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch wallet
      .addCase(fetchWallet.pending, (state) => {
        state.isConnecting = true;
      })
      .addCase(fetchWallet.fulfilled, (state, action) => {
        state.isConnecting = false;
        state.wallet = action.payload;
        state.isConnected = !!action.payload;
        if (action.payload?.balance !== undefined) {
          state.balance = action.payload.balance;
        }
      })
      .addCase(fetchWallet.rejected, (state) => {
        state.isConnecting = false;
        state.wallet = null;
        state.isConnected = false;
      })
      // Connect wallet
      .addCase(connectWallet.pending, (state) => {
        state.isConnecting = true;
      })
      .addCase(connectWallet.fulfilled, (state, action) => {
        state.isConnecting = false;
        state.wallet = action.payload;
        state.isConnected = true;
        state.balance = action.payload.balance || null;
      })
      .addCase(connectWallet.rejected, (state) => {
        state.isConnecting = false;
      })
      // Refresh balance
      .addCase(refreshBalance.fulfilled, (state, action) => {
        state.balance = action.payload;
      });
  },
});

export const { disconnectWallet, setBalance } = walletSlice.actions;
export default walletSlice.reducer;

