import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateTransactionHashDto {
  @IsString()
  @IsNotEmpty()
  txHash: string;
}

