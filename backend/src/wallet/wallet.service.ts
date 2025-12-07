import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TempWallet, TempWalletStatus } from '../entities/temp-wallet.entity';
import { encrypt, decrypt } from '../utils/encryption.util';

// Use require for TronWeb as it's a CommonJS module
const TronWebModule = require('tronweb');
const TronWeb = TronWebModule.TronWeb || TronWebModule.default || TronWebModule;

@Injectable()
export class WalletService {
  private tronWeb: any;
  private readonly USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // USDT TRC20 contract address

  constructor(
    @InjectRepository(TempWallet)
    private tempWalletRepository: Repository<TempWallet>,
  ) {
    // Initialize TronWeb
    const fullNode = process.env.TRON_FULL_NODE || 'https://api.trongrid.io';
    const solidityNode = process.env.TRON_SOLIDITY_NODE || 'https://api.trongrid.io';
    const eventServer = process.env.TRON_EVENT_SERVER || 'https://api.trongrid.io';

    this.tronWeb = new TronWeb({
      fullHost: fullNode,
      solidityNode: solidityNode,
      eventServer: eventServer,
    });
  }

  async getOrCreateTempWallet(userId: string): Promise<TempWallet> {
    // Check if user has an active temp wallet
    const existingWallet = await this.tempWalletRepository.findOne({
      where: { userId, status: TempWalletStatus.ACTIVE },
    });

    if (existingWallet) {
      return existingWallet;
    }

    // Generate new wallet
    const account = this.tronWeb.utils.accounts.generateAccount();
    const address = account.address.base58;
    const privateKey = account.privateKey;

    // Encrypt private key before storing
    const encryptedPrivateKey = encrypt(privateKey);

    const tempWallet = this.tempWalletRepository.create({
      userId,
      address,
      privateKey: encryptedPrivateKey,
      status: TempWalletStatus.ACTIVE,
      totalReceived: 0,
    });

    return await this.tempWalletRepository.save(tempWallet);
  }

  async getTempWallet(userId: string): Promise<TempWallet | null> {
    return await this.tempWalletRepository.findOne({
      where: { userId, status: TempWalletStatus.ACTIVE },
    });
  }

  async getDecryptedPrivateKey(tempWallet: TempWallet): Promise<string> {
    return decrypt(tempWallet.privateKey);
  }

  async checkWalletPayment(
    walletAddress: string,
    expectedAmount: number,
    tolerance: number = 0.01,
  ): Promise<{ success: boolean; transactionHash?: string; amount?: number }> {
    try {
      // Get TRC20 token transactions using TronGrid API
      const tronGridUrl = process.env.TRON_GRID_URL || 'https://api.trongrid.io';
      const response = await fetch(
        `${tronGridUrl}/v1/accounts/${walletAddress}/transactions/trc20?only_confirmed=true&limit=50&contract_address=${this.USDT_CONTRACT}`,
      );

      if (!response.ok) {
        console.error('Failed to fetch transactions from TronGrid');
        return { success: false };
      }

      const data = await response.json();
      const transactions = data.data || [];

      // Check for matching transactions
      for (const tx of transactions) {
        if (tx.type === 'Transfer' && tx.to === walletAddress) {
          const amount = Number(tx.value) / 1e6; // USDT has 6 decimals

          // Check if amount matches expected (within tolerance)
          if (Math.abs(amount - expectedAmount) <= tolerance) {
            return {
              success: true,
              transactionHash: tx.transaction_id,
              amount: amount,
            };
          }
        }
      }

      return { success: false };
    } catch (error) {
      console.error('Error checking wallet payment:', error);
      return { success: false };
    }
  }

  async sendUSDT(
    fromPrivateKey: string,
    toAddress: string,
    amount: number,
  ): Promise<string> {
    try {
      // Set private key
      this.tronWeb.setPrivateKey(fromPrivateKey);

      // Get contract instance
      const contract = await this.tronWeb.contract().at(this.USDT_CONTRACT);

      // Convert amount to smallest unit (USDT has 6 decimals)
      const amountInSmallestUnit = Math.floor(amount * 1e6);

      // Send transaction
      const transaction = await contract.transfer(toAddress, amountInSmallestUnit).send();

      return transaction;
    } catch (error) {
      console.error('Error sending USDT:', error);
      throw new BadRequestException(`Failed to send USDT: ${error.message}`);
    }
  }

  async estimateGasFee(): Promise<number> {
    // TRX price in USDT (you can fetch this from an API or use a fixed rate)
    // For now, using a conservative estimate
    const trxPriceInUSDT = 0.1; // This should be fetched from an API
    const estimatedTRX = 15; // Conservative estimate for USDT transfer
    return estimatedTRX * trxPriceInUSDT;
  }

  async getTRXBalance(walletAddress: string): Promise<number> {
    try {
      const balance = await this.tronWeb.trx.getBalance(walletAddress);
      return balance / 1e6; // Convert from sun to TRX
    } catch (error) {
      console.error('Error getting TRX balance:', error);
      return 0;
    }
  }

  async updateWalletLastChecked(walletId: string): Promise<void> {
    await this.tempWalletRepository.update(walletId, {
      lastCheckedAt: new Date(),
    });
  }
}

