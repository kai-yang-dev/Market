import { IsNumber, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ChargeDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(0.01)
  amount: number;

  @IsNotEmpty()
  transactionHash: string;
}

