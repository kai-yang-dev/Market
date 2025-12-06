import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Milestone } from './milestone.entity';

@Entity('temp_wallets')
export class TempWallet extends BaseEntity {
  @Column({ name: 'milestone_id', unique: true })
  milestoneId: string;

  @ManyToOne(() => Milestone)
  @JoinColumn({ name: 'milestone_id' })
  milestone: Milestone;

  @Column({ name: 'wallet_address' })
  walletAddress: string;

  @Column({ name: 'private_key', type: 'text' })
  privateKey: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}

