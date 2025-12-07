import { IsNumber, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class InitiateChargeDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(0.01)
  amount: number;
}

