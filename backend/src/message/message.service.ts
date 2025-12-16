import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../entities/message.entity';
import { Conversation } from '../entities/conversation.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChatGateway } from '../chat/chat.gateway';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../entities/notification.entity';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
  ) {}

  async create(conversationId: string, userId: string, createMessageDto: CreateMessageDto, isAdmin: boolean = false): Promise<Message> {
    // Verify conversation exists and user has access
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, deletedAt: null },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Admin can send messages to disputed conversations
    if (!isAdmin && conversation.clientId !== userId && conversation.providerId !== userId) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    const message = this.messageRepository.create({
      conversationId,
      senderId: userId,
      message: createMessageDto.message,
      attachmentFiles: createMessageDto.attachmentFiles,
    });

    const savedMessage = await this.messageRepository.save(message);

    // Update conversation's updatedAt
    await this.conversationRepository.update(conversationId, { updatedAt: new Date() });

    // Load message with sender info for WebSocket emission
    const messageWithSender = await this.findOne(savedMessage.id);

    // Emit to all clients in the conversation room
    this.chatGateway.server.to(`conversation:${conversationId}`).emit('new_message', messageWithSender);

    // Create notification for recipients (client and provider) only if they're not in the conversation room
    const recipients = [conversation.clientId, conversation.providerId].filter(id => id && id !== userId);
    
    for (const recipientId of recipients) {
      // Check if recipient is in the conversation room (i.e., currently viewing the chat)
      let recipientIsInRoom = false;
      try {
        // Use fetchSockets to get all sockets in the room
        const socketsInRoom = await this.chatGateway.server.in(`conversation:${conversationId}`).fetchSockets();
        recipientIsInRoom = socketsInRoom.some((socket) => {
          return socket.data.userId === recipientId;
        });
      } catch (error) {
        // If we can't check, assume recipient is not in room (safer to send notification)
        console.error('Error checking if recipient is in room:', error);
        recipientIsInRoom = false;
      }

      // Only send notification if recipient is NOT in the conversation room
      if (!recipientIsInRoom) {
        const senderName = messageWithSender.sender
          ? `${messageWithSender.sender.firstName || ''} ${messageWithSender.sender.lastName || ''}`.trim() || messageWithSender.sender.userName || 'Someone'
          : 'Someone';
        
        const messagePreview = createMessageDto.message.length > 100 
          ? createMessageDto.message.substring(0, 100) + '...'
          : createMessageDto.message;

        await this.notificationService.createNotification(
          recipientId,
          NotificationType.MESSAGE,
          'New Message',
          `${senderName}: ${messagePreview}`,
          { conversationId, messageId: savedMessage.id },
        );
      }
    }

    return messageWithSender;
  }

  async findAll(
    conversationId: string,
    userId: string,
    isAdmin: boolean = false,
    limit: number = 50,
    before?: string,
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    // Verify conversation exists and user has access
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, deletedAt: null },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (!isAdmin && conversation.clientId !== userId && conversation.providerId !== userId) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .where('message.conversationId = :conversationId', { conversationId })
      .andWhere('message.deletedAt IS NULL')
      .leftJoinAndSelect('message.sender', 'sender')
      .orderBy('message.createdAt', 'DESC')
      .take(limit + 1); // Fetch one extra to check if there are more

    // If before is provided, fetch messages before that message
    if (before) {
      const beforeMessage = await this.messageRepository.findOne({
        where: { id: before },
      });
      if (beforeMessage) {
        queryBuilder.andWhere('message.createdAt < :beforeDate', {
          beforeDate: beforeMessage.createdAt,
        });
      }
    }

    const messages = await queryBuilder.getMany();
    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;

    // Reverse to get chronological order (oldest to newest)
    return {
      messages: resultMessages.reverse(),
      hasMore,
    };
  }

  async findOne(id: string): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id, deletedAt: null },
      relations: ['sender', 'conversation'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return message;
  }
}

