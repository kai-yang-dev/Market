import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MilestoneService } from './milestone.service';
import { MilestoneController } from './milestone.controller';
import { Milestone } from '../entities/milestone.entity';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { ChatModule } from '../chat/chat.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Milestone, Conversation, Message]),
    forwardRef(() => ChatModule),
    PaymentModule,
  ],
  controllers: [MilestoneController],
  providers: [MilestoneService],
  exports: [MilestoneService],
})
export class MilestoneModule {}

