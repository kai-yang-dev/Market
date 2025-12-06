import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Milestone, MilestoneStatus } from '../entities/milestone.entity';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneStatusDto } from './dto/update-milestone-status.dto';
import { ChatGateway } from '../chat/chat.gateway';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class MilestoneService {
  constructor(
    @InjectRepository(Milestone)
    private milestoneRepository: Repository<Milestone>,
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
    private walletService: WalletService,
  ) {}

  async create(conversationId: string, userId: string, createMilestoneDto: CreateMilestoneDto): Promise<Milestone> {
    // Verify conversation exists and user is the client
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, deletedAt: null },
      relations: ['service'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.clientId !== userId) {
      throw new ForbiddenException('Only the client can create milestones');
    }

    const milestone = this.milestoneRepository.create({
      clientId: conversation.clientId,
      providerId: conversation.providerId,
      serviceId: createMilestoneDto.serviceId || conversation.serviceId,
      title: createMilestoneDto.title,
      description: createMilestoneDto.description,
      attachedFiles: createMilestoneDto.attachedFiles,
      balance: createMilestoneDto.balance,
      status: MilestoneStatus.DRAFT,
    });

    const savedMilestone = await this.milestoneRepository.save(milestone);
    
    // Get client wallet
    const clientWallet = await this.walletService.getUserWallet(userId);
    if (!clientWallet) {
      throw new BadRequestException('Please connect your wallet before creating a milestone');
    }

    // Create payment transaction (payment will be processed from frontend)
    await this.walletService.processMilestonePayment(
      savedMilestone.id,
      clientWallet.walletAddress,
      createMilestoneDto.balance,
      userId,
    );
    
    // Emit milestone update via WebSocket
    this.chatGateway.emitMilestoneUpdate(conversationId, savedMilestone).catch((error) => {
      console.error('Failed to emit milestone update:', error);
    });

    return savedMilestone;
  }

  async findAll(conversationId: string, userId: string): Promise<Milestone[]> {
    // Verify conversation exists and user has access
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, deletedAt: null },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.clientId !== userId && conversation.providerId !== userId) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    return this.milestoneRepository.find({
      where: [
        { clientId: conversation.clientId, providerId: conversation.providerId, serviceId: conversation.serviceId, deletedAt: null },
      ],
      relations: ['client', 'provider', 'service'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId?: string): Promise<Milestone> {
    const milestone = await this.milestoneRepository.findOne({
      where: { id, deletedAt: null },
      relations: ['client', 'provider', 'service'],
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    if (userId && milestone.clientId !== userId && milestone.providerId !== userId) {
      throw new ForbiddenException('You do not have access to this milestone');
    }

    return milestone;
  }

  async updateStatus(id: string, userId: string, updateStatusDto: UpdateMilestoneStatusDto): Promise<Milestone> {
    const milestone = await this.findOne(id, userId);
    const oldStatus = milestone.status;

    // Validate status transitions
    const validTransitions = this.getValidStatusTransitions(milestone.status, userId, milestone.clientId, milestone.providerId);
    
    if (!validTransitions.includes(updateStatusDto.status)) {
      throw new BadRequestException(`Invalid status transition from ${milestone.status} to ${updateStatusDto.status}`);
    }

    milestone.status = updateStatusDto.status;
    const savedMilestone = await this.milestoneRepository.save(milestone);
    
    // Handle payment flows based on status change
    await this.handlePaymentFlow(savedMilestone, oldStatus, updateStatusDto.status);
    
    // Find conversation ID from milestone
    const milestoneWithConversation = await this.milestoneRepository.findOne({
      where: { id: savedMilestone.id },
      relations: ['service'],
    });
    
    if (milestoneWithConversation) {
      // Find conversation by service, client, and provider
      const conv = await this.conversationRepository.findOne({
        where: {
          serviceId: milestoneWithConversation.serviceId,
          clientId: milestone.clientId,
          providerId: milestone.providerId,
          deletedAt: null,
        },
      });
      
      if (conv) {
        // Create a system message for milestone status update
        const statusChangeMessage = this.messageRepository.create({
          conversationId: conv.id,
          senderId: userId,
          message: `Milestone "${milestone.title}" status changed from ${oldStatus} to ${updateStatusDto.status}`,
        });
        
        const savedMessage = await this.messageRepository.save(statusChangeMessage);
        
        // Update conversation's updatedAt
        await this.conversationRepository.update(conv.id, { updatedAt: new Date() });
        
        // Load message with sender info
        const messageWithSender = await this.messageRepository.findOne({
          where: { id: savedMessage.id },
          relations: ['sender'],
        });
        
        // Emit new message via WebSocket
        if (messageWithSender) {
          this.chatGateway.server.to(`conversation:${conv.id}`).emit('new_message', messageWithSender);
        }
        
        // Also emit milestone update via WebSocket
        this.chatGateway.emitMilestoneUpdate(conv.id, savedMilestone).catch((error) => {
          console.error('Failed to emit milestone update:', error);
        });
      }
    }
    
    return savedMilestone;
  }

  private getValidStatusTransitions(
    currentStatus: MilestoneStatus,
    userId: string,
    clientId: string,
    providerId: string,
  ): MilestoneStatus[] {
    const isClient = userId === clientId;
    const isProvider = userId === providerId;

    switch (currentStatus) {
      case MilestoneStatus.DRAFT:
        if (isProvider) return [MilestoneStatus.PROCESSING];
        if (isClient) return [MilestoneStatus.CANCELED];
        return [];
      
      case MilestoneStatus.PROCESSING:
        if (isProvider) return [MilestoneStatus.COMPLETED, MilestoneStatus.WITHDRAW];
        if (isClient) return [MilestoneStatus.CANCELED];
        return [];
      
      case MilestoneStatus.COMPLETED:
        if (isClient) return [MilestoneStatus.RELEASED, MilestoneStatus.DISPUTE];
        if (isProvider) return [MilestoneStatus.DISPUTE];
        return [];
      
      case MilestoneStatus.RELEASED:
        // No transitions from released
        return [];
      
      case MilestoneStatus.CANCELED:
        // No transitions from canceled
        return [];
      
      case MilestoneStatus.WITHDRAW:
        // No transitions from withdraw
        return [];
      
      case MilestoneStatus.DISPUTE:
        // Only admin can resolve disputes
        return [];
      
      default:
        return [];
    }
  }

  private async handlePaymentFlow(
    milestone: Milestone,
    oldStatus: MilestoneStatus,
    newStatus: MilestoneStatus,
  ): Promise<void> {
    try {
      // Release payment to provider when milestone is released
      if (newStatus === MilestoneStatus.RELEASED && oldStatus !== MilestoneStatus.RELEASED) {
        const providerWallet = await this.walletService.getUserWallet(milestone.providerId);
        if (providerWallet) {
          await this.walletService.releasePaymentToProvider(
            milestone.id,
            providerWallet.walletAddress,
            milestone.providerId,
          );
        }
      }

      // Refund payment to client when milestone is withdrawn or canceled
      if (
        (newStatus === MilestoneStatus.WITHDRAW || newStatus === MilestoneStatus.CANCELED) &&
        oldStatus !== MilestoneStatus.WITHDRAW &&
        oldStatus !== MilestoneStatus.CANCELED
      ) {
        const clientWallet = await this.walletService.getUserWallet(milestone.clientId);
        if (clientWallet) {
          await this.walletService.refundPaymentToClient(
            milestone.id,
            clientWallet.walletAddress,
            milestone.clientId,
          );
        }
      }
    } catch (error) {
      console.error('Error handling payment flow:', error);
      // Don't throw - payment errors shouldn't block status updates
    }
  }
}

