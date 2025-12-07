import { IsNumber, IsNotEmpty, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class WithdrawDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  walletAddress: string;
}

