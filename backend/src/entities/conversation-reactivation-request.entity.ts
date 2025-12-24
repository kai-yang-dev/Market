import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum ReactivationRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('conversation_reactivation_requests')
export class ConversationReactivationRequest extends BaseEntity {
  @Index()
  @Column({ name: 'conversation_id' })
  conversationId: string;

  @ManyToOne(
    () => require('./conversation.entity').Conversation,
    (conversation: any) => conversation.reactivationRequests,
    { createForeignKeyConstraints: false },
  )
  @JoinColumn({ name: 'conversation_id' })
  conversation: any;

  @Index()
  @Column({ name: 'requester_id' })
  requesterId: string;

  @ManyToOne(() => User, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'requester_id' })
  requester: User;

  @Column({ type: 'enum', enum: ReactivationRequestStatus, default: ReactivationRequestStatus.PENDING })
  status: ReactivationRequestStatus;

  @Column({ name: 'decided_at', type: 'timestamp', nullable: true })
  decidedAt?: Date;

  @Column({ name: 'decided_by', nullable: true })
  decidedById?: string;

  @ManyToOne(() => User, { nullable: true, createForeignKeyConstraints: false })
  @JoinColumn({ name: 'decided_by' })
  decidedBy?: User;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note?: string;
}


