import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Transaction, TransactionStatus, TransactionType } from '../entities/transaction.entity';
import { WalletService } from './wallet.service';
import { PaymentService } from '../payment/payment.service';
import { Balance } from '../entities/balance.entity';

@Injectable()
export class WalletMonitorService {
  private readonly logger = new Logger(WalletMonitorService.name);

  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Balance)
    private balanceRepository: Repository<Balance>,
    private walletService: WalletService,
    @Inject(forwardRef(() => PaymentService))
    private paymentService: PaymentService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async monitorPendingCharges() {
    try {
      const pendingTransactions = await this.transactionRepository.find({
        where: {
          type: TransactionType.CHARGE,
          status: TransactionStatus.PENDING,
          expiresAt: MoreThan(new Date()),
        },
        relations: ['tempWallet'],
      });

      for (const transaction of pendingTransactions) {
        if (!transaction.tempWallet || !transaction.expectedAmount) {
          continue;
        }

        try {
          const result = await this.walletService.checkWalletPayment(
            transaction.tempWallet.address,
            transaction.expectedAmount,
          );

          if (result.success && result.transactionHash) {
            // Update wallet last checked
            await this.walletService.updateWalletLastChecked(transaction.tempWallet.id);

            // Complete the charge transaction
            await this.completeChargeTransaction(
              transaction.id,
              result.transactionHash,
              result.amount || transaction.expectedAmount,
            );
          } else {
            // Update last checked time
            await this.walletService.updateWalletLastChecked(transaction.tempWallet.id);
          }
        } catch (error) {
          this.logger.error(
            `Error monitoring transaction ${transaction.id}:`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error in monitorPendingCharges:', error);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async expireOldTransactions() {
    try {
      const expiredCount = await this.transactionRepository.update(
        {
          status: TransactionStatus.PENDING,
          type: TransactionType.CHARGE,
          expiresAt: LessThan(new Date()),
        },
        { status: TransactionStatus.CANCELLED },
      );

      if (expiredCount.affected && expiredCount.affected > 0) {
        this.logger.log(`Expired ${expiredCount.affected} old charge transactions`);
      }
    } catch (error) {
      this.logger.error('Error expiring old transactions:', error);
    }
  }

  private async completeChargeTransaction(
    transactionId: string,
    transactionHash: string,
    receivedAmount: number,
  ): Promise<void> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
      relations: ['tempWallet'],
    });

    if (!transaction || transaction.status !== TransactionStatus.PENDING) {
      return;
    }

    // Update transaction
    transaction.status = TransactionStatus.SUCCESS;
    transaction.transactionHash = transactionHash;
    transaction.amount = receivedAmount; // Use actual received amount

    await this.transactionRepository.save(transaction);

    // Update user balance
    if (transaction.clientId) {
      const balance = await this.paymentService.getBalance(transaction.clientId);
      const newAmount = Number(balance.amount) + Number(receivedAmount);
      await this.balanceRepository.update(
        { userId: transaction.clientId },
        { amount: newAmount },
      );
    }

    this.logger.log(
      `Completed charge transaction ${transactionId} with hash ${transactionHash}`,
    );
  }
}

