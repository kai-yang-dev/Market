import { IsEnum, IsNotEmpty } from 'class-validator';
import { MilestoneStatus } from '../../entities/milestone.entity';

export class UpdateMilestoneStatusDto {
  @IsEnum(MilestoneStatus)
  @IsNotEmpty()
  status: MilestoneStatus;
}

