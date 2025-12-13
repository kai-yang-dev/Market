import { Entity, Column, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Service } from './service.entity';

export enum MilestoneStatus {
  DRAFT = 'draft',
  PROCESSING = 'processing',
  CANCELED = 'canceled',
  COMPLETED = 'completed',
  WITHDRAW = 'withdraw',
  RELEASED = 'released',
  DISPUTE = 'dispute',
}

@Entity('milestones')
export class Milestone extends BaseEntity {
  @Column({ name: 'client_id' })
  clientId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'client_id' })
  client: User;

  @Column({ name: 'provider_id' })
  providerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'provider_id' })
  provider: User;

  @Column({ name: 'service_id' })
  serviceId: string;

  @ManyToOne(() => Service)
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'attached_files', type: 'json', nullable: true })
  attachedFiles?: string[];

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  balance: number;

  @Column({
    type: 'enum',
    enum: MilestoneStatus,
    default: MilestoneStatus.DRAFT,
  })
  status: MilestoneStatus;

  @Column({ type: 'text', nullable: true })
  feedback?: string;

  @Column({ type: 'int', nullable: true })
  rating?: number;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}

