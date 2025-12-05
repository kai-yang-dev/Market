import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { Conversation } from '../entities/conversation.entity';
import { Service } from '../entities/service.entity';
import { Message } from '../entities/message.entity';
import { Milestone } from '../entities/milestone.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Service, Message, Milestone])],
  controllers: [ConversationController],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}

