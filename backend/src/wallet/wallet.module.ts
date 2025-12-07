import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { WalletService } from './wallet.service';
import { WalletMonitorService } from './wallet-monitor.service';
import { TempWallet } from '../entities/temp-wallet.entity';
import { Transaction } from '../entities/transaction.entity';
import { Balance } from '../entities/balance.entity';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TempWallet, Transaction, Balance]),
    ScheduleModule.forRoot(),
    forwardRef(() => PaymentModule),
  ],
  providers: [WalletService, WalletMonitorService],
  exports: [WalletService],
})
export class WalletModule {}

