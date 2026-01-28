import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnblockRequest, UnblockRequestStatus } from '../entities/unblock-request.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class UnblockRequestService {
  constructor(
    @InjectRepository(UnblockRequest)
    private unblockRequestRepository: Repository<UnblockRequest>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async createRequest(userId: string, message: string): Promise<UnblockRequest> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user is actually blocked
    if (user.status === 'active') {
      throw new BadRequestException('Your account is already active');
    }

    // Check if there's already a pending request
    const existingRequest = await this.unblockRequestRepository.findOne({
      where: {
        userId,
        status: UnblockRequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      throw new BadRequestException('You already have a pending unblock request');
    }

    const request = this.unblockRequestRepository.create({
      userId,
      message,
      status: UnblockRequestStatus.PENDING,
    });

    return await this.unblockRequestRepository.save(request);
  }

  async getAllRequests(
    page: number = 1,
    limit: number = 20,
    status?: UnblockRequestStatus,
  ): Promise<{ data: UnblockRequest[]; total: number; page: number; limit: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const queryBuilder = this.unblockRequestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.user', 'user')
      .leftJoinAndSelect('request.decidedBy', 'decidedBy')
      .orderBy('request.createdAt', 'DESC');

    if (status) {
      queryBuilder.andWhere('request.status = :status', { status });
    }

    const [data, total] = await queryBuilder.skip(skip).take(limit).getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async approveRequest(requestId: string, adminId: string, adminNote?: string): Promise<UnblockRequest> {
    const request = await this.unblockRequestRepository.findOne({
      where: { id: requestId },
      relations: ['user'],
    });

    if (!request) {
      throw new NotFoundException('Unblock request not found');
    }

    if (request.status !== UnblockRequestStatus.PENDING) {
      throw new BadRequestException('Request has already been processed');
    }

    request.status = UnblockRequestStatus.APPROVED;
    request.decidedAt = new Date();
    request.decidedById = adminId;
    request.adminNote = adminNote;

    // Unblock the user
    if (request.user) {
      request.user.status = 'active';
      await this.userRepository.save(request.user);
    }

    return await this.unblockRequestRepository.save(request);
  }

  async rejectRequest(requestId: string, adminId: string, adminNote?: string): Promise<UnblockRequest> {
    const request = await this.unblockRequestRepository.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Unblock request not found');
    }

    if (request.status !== UnblockRequestStatus.PENDING) {
      throw new BadRequestException('Request has already been processed');
    }

    request.status = UnblockRequestStatus.REJECTED;
    request.decidedAt = new Date();
    request.decidedById = adminId;
    request.adminNote = adminNote;

    return await this.unblockRequestRepository.save(request);
  }
}

