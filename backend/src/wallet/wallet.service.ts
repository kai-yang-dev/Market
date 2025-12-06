import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from '../entities/wallet.entity';
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity';
import { TempWallet } from '../entities/temp-wallet.entity';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(TempWallet)
    private tempWalletRepository: Repository<TempWallet>,
    private paymentService: PaymentService,
  ) {}

  /**
   * Connect or update user wallet
   */
  async connectWallet(userId: string, walletAddress: string): Promise<Wallet> {
    if (!this.paymentService.isValidAddress(walletAddress)) {
      throw new BadRequestException('Invalid Tron wallet address');
    }

    let wallet = await this.walletRepository.findOne({
      where: { userId, walletType: 'tron' },
    });

    if (wallet) {
      wallet.walletAddress = walletAddress;
      wallet.isConnected = true;
      wallet.connectedAt = new Date();
    } else {
      wallet = this.walletRepository.create({
        userId,
        walletAddress,
        walletType: 'tron',
        isConnected: true,
        connectedAt: new Date(),
      });
    }

    return this.walletRepository.save(wallet);
  }

  /**
   * Get user wallet
   */
  async getUserWallet(userId: string): Promise<Wallet | null> {
    return this.walletRepository.findOne({
      where: { userId, walletType: 'tron' },
      relations: ['user'],
    });
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(walletAddress: string): Promise<number> {
    return this.paymentService.getUSDTBalance(walletAddress);
  }

  /**
   * Create a temp wallet for a milestone
   */
  async createTempWallet(milestoneId: string): Promise<TempWallet> {
    // Check if temp wallet already exists
    const existing = await this.tempWalletRepository.findOne({
      where: { milestoneId },
    });

    if (existing) {
      return existing;
    }

    const { address, privateKey } = await this.paymentService.generateWallet();

    const tempWallet = this.tempWalletRepository.create({
      milestoneId,
      walletAddress: address,
      privateKey,
      isActive: true,
    });

    return this.tempWalletRepository.save(tempWallet);
  }

  /**
   * Get temp wallet for a milestone
   */
  async getTempWallet(milestoneId: string): Promise<TempWallet | null> {
    return this.tempWalletRepository.findOne({
      where: { milestoneId },
    });
  }

  /**
   * Process payment from client to temp wallet
   */
  async processMilestonePayment(
    milestoneId: string,
    clientWalletAddress: string,
    amount: number,
    clientId?: string,
  ): Promise<Transaction> {
    // Create or get temp wallet
    const tempWallet = await this.createTempWallet(milestoneId);

    // Get wallet to find user ID
    let fromUserId = clientId;
    if (!fromUserId) {
      const wallet = await this.walletRepository.findOne({
        where: { walletAddress: clientWalletAddress },
      });
      fromUserId = wallet?.userId;
    }

    // Create transaction record
    const transaction = this.transactionRepository.create({
      milestoneId,
      fromUserId,
      fromWalletAddress: clientWalletAddress,
      toWalletAddress: tempWallet.walletAddress,
      tempWalletAddress: tempWallet.walletAddress,
      amount,
      tokenType: 'USDT',
      tokenStandard: 'TRC20',
      type: TransactionType.PAYMENT,
      status: TransactionStatus.PENDING,
    });

    const savedTransaction = await this.transactionRepository.save(transaction);

    // Note: The actual transfer should be initiated from the frontend
    // This is just a record. The frontend will call the wallet to transfer
    // and then update this transaction with the txHash

    return savedTransaction;
  }

  /**
   * Update transaction with txHash after payment
   */
  async updateTransactionWithHash(
    transactionId: string,
    txHash: string,
  ): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    transaction.txHash = txHash;
    transaction.status = TransactionStatus.PENDING; // Will be verified later

    // Verify transaction
    const verification = await this.paymentService.verifyTransaction(txHash);
    if (verification.confirmed) {
      transaction.status = verification.success
        ? TransactionStatus.COMPLETED
        : TransactionStatus.FAILED;
      transaction.blockNumber = verification.blockNumber;
    }

    return this.transactionRepository.save(transaction);
  }

  /**
   * Release payment from temp wallet to provider
   */
  async releasePaymentToProvider(
    milestoneId: string,
    providerWalletAddress: string,
    providerId?: string,
  ): Promise<Transaction> {
    const tempWallet = await this.getTempWallet(milestoneId);
    if (!tempWallet) {
      throw new NotFoundException('Temp wallet not found for this milestone');
    }

    // Get the original payment transaction
    const paymentTx = await this.transactionRepository.findOne({
      where: {
        milestoneId,
        type: TransactionType.PAYMENT,
        status: TransactionStatus.COMPLETED,
      },
      order: { createdAt: 'DESC' },
    });

    if (!paymentTx) {
      throw new NotFoundException('Payment transaction not found');
    }

    const amount = paymentTx.amount;

    // Get wallet to find user ID
    let toUserId = providerId;
    if (!toUserId) {
      const wallet = await this.walletRepository.findOne({
        where: { walletAddress: providerWalletAddress },
      });
      toUserId = wallet?.userId;
    }

    // Create release transaction record
    const transaction = this.transactionRepository.create({
      milestoneId,
      toUserId,
      fromWalletAddress: tempWallet.walletAddress,
      toWalletAddress: providerWalletAddress,
      tempWalletAddress: tempWallet.walletAddress,
      amount,
      tokenType: 'USDT',
      tokenStandard: 'TRC20',
      type: TransactionType.RELEASE,
      status: TransactionStatus.PENDING,
    });

    const savedTransaction = await this.transactionRepository.save(transaction);

    // Transfer from temp wallet to provider
    try {
      const txHash = await this.paymentService.transferUSDT(
        tempWallet.privateKey,
        providerWalletAddress,
        amount,
      );

      savedTransaction.txHash = txHash;
      savedTransaction.status = TransactionStatus.PENDING;

      // Verify transaction
      const verification = await this.paymentService.verifyTransaction(txHash);
      if (verification.confirmed) {
        savedTransaction.status = verification.success
          ? TransactionStatus.COMPLETED
          : TransactionStatus.FAILED;
        savedTransaction.blockNumber = verification.blockNumber;
      }

      return this.transactionRepository.save(savedTransaction);
    } catch (error) {
      savedTransaction.status = TransactionStatus.FAILED;
      savedTransaction.error = error.message;
      return this.transactionRepository.save(savedTransaction);
    }
  }

  /**
   * Refund payment from temp wallet to client
   */
  async refundPaymentToClient(
    milestoneId: string,
    clientWalletAddress: string,
    clientId?: string,
  ): Promise<Transaction> {
    const tempWallet = await this.getTempWallet(milestoneId);
    if (!tempWallet) {
      throw new NotFoundException('Temp wallet not found for this milestone');
    }

    // Get the original payment transaction
    const paymentTx = await this.transactionRepository.findOne({
      where: {
        milestoneId,
        type: TransactionType.PAYMENT,
        status: TransactionStatus.COMPLETED,
      },
      order: { createdAt: 'DESC' },
    });

    if (!paymentTx) {
      throw new NotFoundException('Payment transaction not found');
    }

    const amount = paymentTx.amount;

    // Get wallet to find user ID
    let toUserId = clientId;
    if (!toUserId) {
      const wallet = await this.walletRepository.findOne({
        where: { walletAddress: clientWalletAddress },
      });
      toUserId = wallet?.userId;
    }

    // Create refund transaction record
    const transaction = this.transactionRepository.create({
      milestoneId,
      toUserId,
      fromWalletAddress: tempWallet.walletAddress,
      toWalletAddress: clientWalletAddress,
      tempWalletAddress: tempWallet.walletAddress,
      amount,
      tokenType: 'USDT',
      tokenStandard: 'TRC20',
      type: TransactionType.REFUND,
      status: TransactionStatus.PENDING,
    });

    const savedTransaction = await this.transactionRepository.save(transaction);

    // Transfer from temp wallet to client
    try {
      const txHash = await this.paymentService.transferUSDT(
        tempWallet.privateKey,
        clientWalletAddress,
        amount,
      );

      savedTransaction.txHash = txHash;
      savedTransaction.status = TransactionStatus.PENDING;

      // Verify transaction
      const verification = await this.paymentService.verifyTransaction(txHash);
      if (verification.confirmed) {
        savedTransaction.status = verification.success
          ? TransactionStatus.COMPLETED
          : TransactionStatus.FAILED;
        savedTransaction.blockNumber = verification.blockNumber;
      }

      return this.transactionRepository.save(savedTransaction);
    } catch (error) {
      savedTransaction.status = TransactionStatus.FAILED;
      savedTransaction.error = error.message;
      return this.transactionRepository.save(savedTransaction);
    }
  }

  /**
   * Get user transactions
   */
  async getUserTransactions(userId: string): Promise<Transaction[]> {
    return this.transactionRepository.find({
      where: [
        { fromUserId: userId },
        { toUserId: userId },
      ],
      relations: ['milestone', 'fromUser', 'toUser'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get milestone transactions
   */
  async getMilestoneTransactions(milestoneId: string): Promise<Transaction[]> {
    return this.transactionRepository.find({
      where: { milestoneId },
      relations: ['fromUser', 'toUser'],
      order: { createdAt: 'ASC' },
    });
  }
}

