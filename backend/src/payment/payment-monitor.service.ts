import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity';
import { PaymentService } from './payment.service';

@Injectable()
export class PaymentMonitorService {
  private readonly logger = new Logger(PaymentMonitorService.name);

  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private paymentService: PaymentService,
  ) {}

  /**
   * Monitor pending charge transactions every 30 seconds
   */
  @Cron('*/30 * * * * *') // Every 30 seconds
  async monitorPendingCharges() {
    try {
      const pendingTransactions = await this.transactionRepository.find({
        where: {
          type: TransactionType.CHARGE,
          status: TransactionStatus.PENDING,
        },
        relations: ['tempWallet'],
        take: 50, // Process up to 50 transactions per run
      });

      if (pendingTransactions.length === 0) {
        return;
      }

      this.logger.debug(`Monitoring ${pendingTransactions.length} pending charge transactions`);

      for (const transaction of pendingTransactions) {
        try {
          // Check if expired
          if (transaction.expiresAt && new Date() > transaction.expiresAt) {
            transaction.status = TransactionStatus.CANCELLED;
            await this.transactionRepository.save(transaction);
            this.logger.log(`Transaction ${transaction.id} expired and cancelled`);
            continue;
          }

          // Monitor payment
          const result = await this.paymentService.monitorTempWalletPayment(transaction.id);
          
          if (result.success) {
            this.logger.log(`Charge transaction ${transaction.id} processed successfully`);
          } else if (result.message && result.message.includes('Insufficient amount')) {
            this.logger.warn(`Transaction ${transaction.id}: ${result.message}`);
          }
        } catch (error) {
          this.logger.error(`Error monitoring transaction ${transaction.id}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error in monitorPendingCharges:', error);
    }
  }

  /**
   * Cancel expired transactions every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cancelExpiredTransactions() {
    try {
      const result = await this.transactionRepository.update(
        {
          type: TransactionType.CHARGE,
          status: TransactionStatus.PENDING,
          expiresAt: LessThan(new Date()),
        },
        {
          status: TransactionStatus.CANCELLED,
        },
      );

      if (result.affected && result.affected > 0) {
        this.logger.log(`Cancelled ${result.affected} expired transactions`);
      }
    } catch (error) {
      this.logger.error('Error cancelling expired transactions:', error);
    }
  }
}

