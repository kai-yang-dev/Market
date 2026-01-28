import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnblockRequestController } from './unblock-request.controller';
import { UnblockRequestService } from './unblock-request.service';
import { UnblockRequest } from '../entities/unblock-request.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UnblockRequest, User])],
  controllers: [UnblockRequestController],
  providers: [UnblockRequestService],
  exports: [UnblockRequestService],
})
export class UnblockRequestModule {}

