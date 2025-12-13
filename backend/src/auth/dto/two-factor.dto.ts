import { IsString, IsNotEmpty, Length, Matches, IsIn, MinLength } from 'class-validator';

export class EnableTwoFactorDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['totp', 'sms', 'email'])
  method: 'totp' | 'sms' | 'email';
}

export class VerifyTwoFactorSetupDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d+$/, { message: 'Code must contain only digits' })
  code: string;
}

export class VerifyTwoFactorLoginDto {
  @IsString()
  @IsNotEmpty()
  @Length(4, 10)
  code: string;
}

export class DisableTwoFactorDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}

export class RegenerateBackupCodesDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}

