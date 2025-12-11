import { Controller, Post, Body, Get, UseGuards, Request, Param } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminSignInDto } from './dto/admin-signin.dto';
import { AdminGuard } from './guards/admin.guard';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('signin')
  async signIn(@Body() dto: AdminSignInDto) {
    return this.adminService.signIn(dto);
  }

  @UseGuards(AdminGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    return this.adminService.getProfile(req.user.id);
  }

  @UseGuards(AdminGuard)
  @Get('withdraws')
  async getWithdraws() {
    return this.adminService.getWithdraws();
  }

  @UseGuards(AdminGuard)
  @Post('withdraws/:withdrawId/accept')
  async acceptWithdraw(@Param('withdrawId') withdrawId: string) {
    return this.adminService.acceptWithdraw(withdrawId);
  }
}

