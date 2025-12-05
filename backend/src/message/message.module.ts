import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { Message } from '../entities/message.entity';
import { Conversation } from '../entities/conversation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Message, Conversation])],
  controllers: [MessageController],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessageModule {}

