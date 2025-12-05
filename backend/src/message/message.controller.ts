import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post('conversation/:conversationId')
  @UseGuards(JwtAuthGuard)
  async create(
    @Param('conversationId') conversationId: string,
    @Request() req,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    const isAdmin = req.user.role === 'admin';
    return this.messageService.create(conversationId, req.user.id, createMessageDto, isAdmin);
  }

  @Get('conversation/:conversationId')
  @UseGuards(JwtAuthGuard)
  async findAll(@Param('conversationId') conversationId: string, @Request() req) {
    const isAdmin = req.user.role === 'admin';
    return this.messageService.findAll(conversationId, req.user.id, isAdmin);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    return this.messageService.findOne(id);
  }
}

