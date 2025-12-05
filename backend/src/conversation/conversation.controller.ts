import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/guards/admin.guard';

@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Request() req, @Body() createConversationDto: CreateConversationDto) {
    const conversation = await this.conversationService.create(req.user.id, createConversationDto);
    return conversation;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Request() req) {
    return this.conversationService.findAll(req.user.id);
  }

  @Get('admin/disputed')
  @UseGuards(AdminGuard)
  async findDisputed(@Request() req) {
    // Get all conversations with disputed milestones
    return this.conversationService.findDisputed();
  }

  @Get('service/:serviceId/provider')
  @UseGuards(JwtAuthGuard)
  async findByServiceIdAsProvider(@Param('serviceId') serviceId: string, @Request() req) {
    return this.conversationService.findByServiceIdAsProvider(serviceId, req.user.id);
  }

  @Get('service/:serviceId')
  @UseGuards(JwtAuthGuard)
  async findByServiceId(@Param('serviceId') serviceId: string, @Request() req) {
    return this.conversationService.findByServiceId(serviceId, req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @Request() req) {
    const isAdmin = req.user.role === 'admin';
    return this.conversationService.findOne(id, req.user.id, isAdmin);
  }
}

