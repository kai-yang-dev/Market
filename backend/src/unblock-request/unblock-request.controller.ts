import { Controller, Post, Get, Body, UseGuards, Request, Query, Param } from '@nestjs/common';
import { UnblockRequestService } from './unblock-request.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { UnblockRequestStatus } from '../entities/unblock-request.entity';

@Controller('unblock-requests')
export class UnblockRequestController {
  constructor(private readonly unblockRequestService: UnblockRequestService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createRequest(@Request() req: any, @Body() body: { message: string }) {
    return this.unblockRequestService.createRequest(req.user.id, body.message);
  }

  @UseGuards(AdminGuard)
  @Get()
  async getAllRequests(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: UnblockRequestStatus,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.unblockRequestService.getAllRequests(pageNum, limitNum, status);
  }

  @UseGuards(AdminGuard)
  @Post(':id/approve')
  async approveRequest(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { adminNote?: string },
  ) {
    return this.unblockRequestService.approveRequest(id, req.user.id, body.adminNote);
  }

  @UseGuards(AdminGuard)
  @Post(':id/reject')
  async rejectRequest(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { adminNote?: string },
  ) {
    return this.unblockRequestService.rejectRequest(id, req.user.id, body.adminNote);
  }
}

