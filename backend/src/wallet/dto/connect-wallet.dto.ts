import { IsString, IsNotEmpty } from 'class-validator';

export class ConnectWalletDto {
  @IsString()
  @IsNotEmpty()
  walletAddress: string;
}

