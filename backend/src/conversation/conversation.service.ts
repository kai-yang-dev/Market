import { Injectable, NotFoundException, ForbiddenException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { Service } from '../entities/service.entity';
import { Message } from '../entities/message.entity';
import { Milestone } from '../entities/milestone.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { MilestoneStatus } from '../entities/milestone.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../entities/notification.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(Milestone)
    private milestoneRepository: Repository<Milestone>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
  ) {}

  async create(userId: string, createConversationDto: CreateConversationDto): Promise<Conversation> {
    // Get the service to find the provider
    const service = await this.serviceRepository.findOne({
      where: { id: createConversationDto.serviceId, deletedAt: null },
      relations: ['user'],
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // Check if user is trying to connect with themselves
    if (service.userId === userId) {
      throw new ForbiddenException('You cannot connect with yourself');
    }

    // Check if conversation already exists
    const existingConversation = await this.conversationRepository.findOne({
      where: {
        serviceId: createConversationDto.serviceId,
        clientId: userId,
        deletedAt: null,
      },
    });

    if (existingConversation) {
      return existingConversation;
    }

    // Create new conversation
    const conversation = this.conversationRepository.create({
      serviceId: createConversationDto.serviceId,
      clientId: userId,
      providerId: service.userId,
    });

    const savedConversation = await this.conversationRepository.save(conversation);

    // Send first connection message
    const firstMessage = this.messageRepository.create({
      conversationId: savedConversation.id,
      senderId: userId,
      message: 'Hello! I\'m interested in your service. Let\'s discuss how we can work together.',
    });

    await this.messageRepository.save(firstMessage);

    // Get client info for notification
    const client = await this.userRepository.findOne({ where: { id: userId } });
    const clientName = client
      ? `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.userName || 'A client'
      : 'A client';

    // Create notification for provider about new connection
    await this.notificationService.createNotification(
      service.userId,
      NotificationType.MESSAGE,
      'New Connection Request',
      `${clientName} wants to connect with you about "${service.title}"`,
      { conversationId: savedConversation.id, serviceId: service.id, clientId: userId },
    );

    return this.findOne(savedConversation.id);
  }

  async findAll(userId: string): Promise<Conversation[]> {
    return this.conversationRepository.find({
      where: [
        { clientId: userId, deletedAt: null },
        { providerId: userId, deletedAt: null },
      ],
      relations: ['service', 'client', 'provider', 'service.category'],
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(id: string, userId?: string, isAdmin: boolean = false): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id, deletedAt: null },
      relations: ['service', 'client', 'provider', 'service.category', 'messages', 'messages.sender'],
      order: { messages: { createdAt: 'ASC' } },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Check if user has access to this conversation
    // Admin can access if there's a disputed milestone
    if (userId && !isAdmin && conversation.clientId !== userId && conversation.providerId !== userId) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    return conversation;
  }

  async findByServiceId(serviceId: string, userId: string): Promise<Conversation | null> {
    return this.conversationRepository.findOne({
      where: {
        serviceId,
        clientId: userId,
        deletedAt: null,
      },
      relations: ['service', 'client', 'provider'],
    });
  }

  async findByServiceIdAsProvider(serviceId: string, providerId: string): Promise<Conversation[]> {
    // Verify the service belongs to the provider
    const service = await this.serviceRepository.findOne({
      where: { id: serviceId, userId: providerId, deletedAt: null },
    });

    if (!service) {
      throw new ForbiddenException('You are not the provider of this service');
    }

    const conversations = await this.conversationRepository.find({
      where: {
        serviceId,
        providerId,
        deletedAt: null,
      },
      relations: ['client', 'service'],
      order: { updatedAt: 'DESC' },
    });

    // Load last message for each conversation
    const conversationsWithMessages = await Promise.all(
      conversations.map(async (conversation) => {
        const messages = await this.messageRepository.find({
          where: { conversationId: conversation.id, deletedAt: null },
          order: { createdAt: 'DESC' },
          take: 1,
          relations: ['sender'],
        });
        return {
          ...conversation,
          messages: messages || [],
        };
      }),
    );

    return conversationsWithMessages;
  }

  async findDisputed(): Promise<Array<Conversation & { disputedMilestones: any[] }>> {
    // Find all milestones with dispute status
    const disputedMilestones = await this.milestoneRepository.find({
      where: { status: MilestoneStatus.DISPUTE, deletedAt: null },
      relations: ['client', 'provider', 'service'],
      order: { createdAt: 'DESC' },
    });

    if (disputedMilestones.length === 0) {
      return [];
    }

    // Group milestones by conversation
    const conversationMap = new Map<string, any[]>();
    const conversationIds = new Set<string>();

    for (const milestone of disputedMilestones) {
      // Find conversation by service, client, and provider
      const conversation = await this.conversationRepository.findOne({
        where: {
          serviceId: milestone.serviceId,
          clientId: milestone.clientId,
          providerId: milestone.providerId,
          deletedAt: null,
        },
      });
      if (conversation) {
        conversationIds.add(conversation.id);
        if (!conversationMap.has(conversation.id)) {
          conversationMap.set(conversation.id, []);
        }
        conversationMap.get(conversation.id)!.push(milestone);
      }
    }

    if (conversationIds.size === 0) {
      return [];
    }

    // Fetch all disputed conversations
    const conversations = await this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.service', 'service')
      .leftJoinAndSelect('service.category', 'category')
      .leftJoinAndSelect('conversation.client', 'client')
      .leftJoinAndSelect('conversation.provider', 'provider')
      .where('conversation.id IN (:...ids)', { ids: Array.from(conversationIds) })
      .andWhere('conversation.deletedAt IS NULL')
      .orderBy('conversation.updatedAt', 'DESC')
      .getMany();

    // Attach disputed milestones to each conversation
    return conversations.map(conv => ({
      ...conv,
      disputedMilestones: conversationMap.get(conv.id) || [],
    }));
  }
}

