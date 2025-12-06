import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('wallets')
export class Wallet extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'wallet_address' })
  walletAddress: string;

  @Column({ name: 'wallet_type', default: 'tron' })
  walletType: string; // 'tron', 'ethereum', etc.

  @Column({ name: 'is_connected', default: true })
  isConnected: boolean;

  @Column({ name: 'connected_at', nullable: true })
  connectedAt?: Date;
}

