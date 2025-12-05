import { Controller, Get, Post, Body, Param, Patch, UseGuards, Request } from '@nestjs/common';
import { MilestoneService } from './milestone.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneStatusDto } from './dto/update-milestone-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MilestoneStatus } from '../entities/milestone.entity';

@Controller('milestones')
export class MilestoneController {
  constructor(private readonly milestoneService: MilestoneService) {}

  @Post('conversation/:conversationId')
  @UseGuards(JwtAuthGuard)
  async create(
    @Param('conversationId') conversationId: string,
    @Request() req,
    @Body() createMilestoneDto: CreateMilestoneDto,
  ) {
    return this.milestoneService.create(conversationId, req.user.id, createMilestoneDto);
  }

  @Get('conversation/:conversationId')
  @UseGuards(JwtAuthGuard)
  async findAll(@Param('conversationId') conversationId: string, @Request() req) {
    return this.milestoneService.findAll(conversationId, req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @Request() req) {
    return this.milestoneService.findOne(id, req.user.id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param('id') id: string,
    @Request() req,
    @Body() updateStatusDto: UpdateMilestoneStatusDto,
  ) {
    return this.milestoneService.updateStatus(id, req.user.id, updateStatusDto);
  }

  // Convenience endpoints for specific status changes
  @Patch(':id/accept')
  @UseGuards(JwtAuthGuard)
  async accept(@Param('id') id: string, @Request() req) {
    return this.milestoneService.updateStatus(id, req.user.id, { status: MilestoneStatus.PROCESSING });
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancel(@Param('id') id: string, @Request() req) {
    return this.milestoneService.updateStatus(id, req.user.id, { status: MilestoneStatus.CANCELED });
  }

  @Patch(':id/complete')
  @UseGuards(JwtAuthGuard)
  async complete(@Param('id') id: string, @Request() req) {
    return this.milestoneService.updateStatus(id, req.user.id, { status: MilestoneStatus.COMPLETED });
  }

  @Patch(':id/withdraw')
  @UseGuards(JwtAuthGuard)
  async withdraw(@Param('id') id: string, @Request() req) {
    return this.milestoneService.updateStatus(id, req.user.id, { status: MilestoneStatus.WITHDRAW });
  }

  @Patch(':id/release')
  @UseGuards(JwtAuthGuard)
  async release(@Param('id') id: string, @Request() req) {
    return this.milestoneService.updateStatus(id, req.user.id, { status: MilestoneStatus.RELEASED });
  }

  @Patch(':id/dispute')
  @UseGuards(JwtAuthGuard)
  async dispute(@Param('id') id: string, @Request() req) {
    return this.milestoneService.updateStatus(id, req.user.id, { status: MilestoneStatus.DISPUTE });
  }
}

