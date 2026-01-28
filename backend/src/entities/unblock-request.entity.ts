import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum UnblockRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('unblock_requests')
export class UnblockRequest extends BaseEntity {
  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'enum', enum: UnblockRequestStatus, default: UnblockRequestStatus.PENDING })
  status: UnblockRequestStatus;

  @Column({ name: 'decided_at', type: 'timestamp', nullable: true })
  decidedAt?: Date;

  @Column({ name: 'decided_by', nullable: true })
  decidedById?: string;

  @ManyToOne(() => User, { nullable: true, createForeignKeyConstraints: false })
  @JoinColumn({ name: 'decided_by' })
  decidedBy?: User;

  @Column({ type: 'varchar', length: 500, nullable: true })
  adminNote?: string;
}

