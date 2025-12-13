import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity';
import { AdminSignInDto } from './dto/admin-signin.dto';
import { PaymentService } from '../payment/payment.service';
import { NotificationService } from '../notification/notification.service';
import { ConversationService } from '../conversation/conversation.service';
import { MilestoneService } from '../milestone/milestone.service';
import { MilestoneStatus } from '../entities/milestone.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private jwtService: JwtService,
    private dataSource: DataSource,
    @Inject(forwardRef(() => PaymentService))
    private paymentService: PaymentService,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
    @Inject(forwardRef(() => ConversationService))
    private conversationService: ConversationService,
    @Inject(forwardRef(() => MilestoneService))
    private milestoneService: MilestoneService,
  ) {}

  async signIn(dto: AdminSignInDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is an admin
    if (user.role !== 'admin') {
      throw new UnauthorizedException('Access denied. Admin privileges required.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        userName: user.userName,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.role !== 'admin') {
      throw new UnauthorizedException('Access denied. Admin privileges required.');
    }

    return {
      id: user.id,
      email: user.email,
      userName: user.userName,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      role: user.role,
    };
  }

  async getWithdraws() {
    const withdraws = await this.transactionRepository.find({
      where: { type: TransactionType.WITHDRAW },
      relations: ['client'],
      order: { createdAt: 'DESC' },
    });

    return withdraws;
  }

  async acceptWithdraw(withdrawId: string) {
    return this.paymentService.processWithdraw(withdrawId);
  }

  async broadcastNotification(title: string, message: string, metadata?: Record<string, any>) {
    return this.notificationService.broadcastNotification(title, message, metadata);
  }

  async getDisputes() {
    return this.conversationService.findDisputed();
  }

  async releaseMilestone(milestoneId: string, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    // Get the milestone
    const milestone = await this.milestoneService.findOne(milestoneId);
    
    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    if (milestone.status !== MilestoneStatus.DISPUTE) {
      throw new BadRequestException('Milestone is not in dispute status');
    }

    // Release milestone with custom amount using payment service
    return this.paymentService.releaseMilestoneTransactionWithAmount(
      milestoneId,
      milestone.providerId,
      amount,
    );
  }
}

