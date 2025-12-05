import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachmentFiles?: string[];
}

