import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Milestone } from './milestone.entity';

export enum TransactionType {
  PAYMENT = 'payment', // Client pays for milestone
  RELEASE = 'release', // Payment released to provider
  REFUND = 'refund', // Refund to client
  WITHDRAW = 'withdraw', // Withdraw refund
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('transactions')
export class Transaction extends BaseEntity {
  @Column({ name: 'milestone_id', nullable: true })
  milestoneId?: string;

  @ManyToOne(() => Milestone, { nullable: true })
  @JoinColumn({ name: 'milestone_id' })
  milestone?: Milestone;

  @Column({ name: 'from_user_id', nullable: true })
  fromUserId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'from_user_id' })
  fromUser?: User;

  @Column({ name: 'to_user_id', nullable: true })
  toUserId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'to_user_id' })
  toUser?: User;

  @Column({ name: 'from_wallet_address' })
  fromWalletAddress: string;

  @Column({ name: 'to_wallet_address' })
  toWalletAddress: string;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  amount: number;

  @Column({ name: 'token_type', default: 'USDT' })
  tokenType: string;

  @Column({ name: 'token_standard', default: 'TRC20' })
  tokenStandard: string;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ name: 'tx_hash', nullable: true })
  txHash?: string;

  @Column({ name: 'block_number', nullable: true })
  blockNumber?: number;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column({ name: 'temp_wallet_address', nullable: true })
  tempWalletAddress?: string; // For milestone escrow transactions
}

