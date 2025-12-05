import { Entity, Column, DeleteDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Service } from './service.entity';

@Entity('conversations')
export class Conversation extends BaseEntity {
  @Column({ name: 'service_id' })
  serviceId: string;

  @ManyToOne(() => Service)
  @JoinColumn({ name: 'service_id' })
  service: Service;

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

  @OneToMany(() => require('./message.entity').Message, (message: any) => message.conversation, { cascade: true })
  messages: any[];

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}

