import { IsString, IsNotEmpty, IsInt, Min, Max } from 'class-validator';

export class ReleaseMilestoneDto {
  @IsString()
  @IsNotEmpty()
  feedback: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;
}

