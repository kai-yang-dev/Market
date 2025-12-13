# Two-Factor Authentication (2FA) Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [2FA Methods](#2fa-methods)
3. [Database Schema Changes](#database-schema-changes)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [Security Considerations](#security-considerations)
7. [Step-by-Step Implementation](#step-by-step-implementation)
8. [Testing](#testing)

---

## Overview

This guide outlines the implementation of Two-Factor Authentication (2FA) for the OmniMart platform. 2FA adds an extra layer of security by requiring users to provide a second authentication factor in addition to their password.

### Current Authentication Flow
- Users sign in with email and password
- JWT tokens are issued upon successful authentication
- Email and phone verification exist for signup, but not for login

### Proposed 2FA Flow
1. User enters email and password
2. If 2FA is enabled, system prompts for 2FA code
3. User provides TOTP code (from authenticator app) or SMS/Email code
4. Upon successful verification, JWT token is issued

---

## 2FA Methods

### 1. TOTP (Time-based One-Time Password) - Recommended
- **Pros**: Most secure, works offline, industry standard
- **Cons**: Requires authenticator app (Google Authenticator, Authy, etc.)
- **Implementation**: Uses `speakeasy` or `otplib` library

### 2. SMS-based 2FA
- **Pros**: Easy to use, no app required
- **Cons**: Vulnerable to SIM swapping, SMS interception
- **Implementation**: Leverage existing `SmsService`

### 3. Email-based 2FA
- **Pros**: Simple, no additional setup
- **Cons**: Less secure if email is compromised
- **Implementation**: Leverage existing `EmailService`

### 4. Backup Codes
- **Pros**: Recovery mechanism if device is lost
- **Cons**: Must be stored securely
- **Implementation**: Generate and store encrypted backup codes

**Recommended Approach**: Implement TOTP as primary method with SMS/Email as fallback, plus backup codes for recovery.

---

## Database Schema Changes

### 1. Add 2FA Fields to Users Table

```sql
-- Add 2FA related columns to users table
ALTER TABLE `users` 
ADD COLUMN `two_factor_enabled` TINYINT(1) NOT NULL DEFAULT 0 AFTER `phone_verified`,
ADD COLUMN `two_factor_secret` VARCHAR(255) NULL AFTER `two_factor_enabled`,
ADD COLUMN `two_factor_method` VARCHAR(50) NULL DEFAULT 'totp' AFTER `two_factor_secret`,
ADD COLUMN `backup_codes` TEXT NULL AFTER `two_factor_method`,
ADD COLUMN `two_factor_verified_at` DATETIME(6) NULL AFTER `backup_codes`;

-- Index for faster lookups
CREATE INDEX `IDX_users_two_factor_enabled` ON `users` (`two_factor_enabled`);
```

### 2. Create 2FA Verification Sessions Table (Optional but Recommended)

```sql
-- Store temporary 2FA verification sessions
CREATE TABLE IF NOT EXISTS `two_factor_sessions` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `session_token` VARCHAR(255) NOT NULL,
  `method` VARCHAR(50) NOT NULL DEFAULT 'totp',
  `code` VARCHAR(10) NULL,
  `expires_at` DATETIME(6) NOT NULL,
  `verified` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX `IDX_two_factor_sessions_user_id` (`user_id`),
  INDEX `IDX_two_factor_sessions_session_token` (`session_token`),
  INDEX `IDX_two_factor_sessions_expires_at` (`expires_at`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## Backend Implementation

### 1. Install Required Dependencies

```bash
cd backend
npm install speakeasy qrcode
npm install --save-dev @types/speakeasy @types/qrcode
```

### 2. Update User Entity

**File**: `backend/src/entities/user.entity.ts`

```typescript
import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('users')
@Unique(['email'])
@Unique(['userName'])
export class User extends BaseEntity {
  // ... existing fields ...

  @Column({ name: 'two_factor_enabled', default: false })
  twoFactorEnabled: boolean;

  @Column({ name: 'two_factor_secret', nullable: true })
  twoFactorSecret?: string;

  @Column({ name: 'two_factor_method', nullable: true, default: 'totp' })
  twoFactorMethod?: string; // 'totp', 'sms', 'email'

  @Column({ name: 'backup_codes', type: 'text', nullable: true })
  backupCodes?: string; // JSON array of hashed backup codes

  @Column({ name: 'two_factor_verified_at', nullable: true })
  twoFactorVerifiedAt?: Date;
}
```

### 3. Create 2FA Service

**File**: `backend/src/auth/two-factor.service.ts`

```typescript
import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TwoFactorService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private emailService: EmailService,
    private smsService: SmsService,
    private jwtService: JwtService,
  ) {}

  /**
   * Generate TOTP secret and QR code for user
   */
  async generateTotpSecret(userId: string, email: string): Promise<{ secret: string; qrCodeUrl: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `OmniMart (${email})`,
      issuer: 'OmniMart',
      length: 32,
    });

    // Store secret temporarily (user hasn't verified yet)
    user.twoFactorSecret = secret.base32;
    await this.userRepository.save(user);

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCodeUrl,
    };
  }

  /**
   * Verify TOTP code during setup
   */
  async verifyTotpSetup(userId: string, code: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('2FA not initialized');
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 2, // Allow 2 time steps (60 seconds) tolerance
    });

    if (verified) {
      // Generate backup codes
      const backupCodes = this.generateBackupCodes();
      const hashedBackupCodes = await Promise.all(
        backupCodes.map(code => bcrypt.hash(code, 10))
      );

      user.twoFactorEnabled = true;
      user.twoFactorMethod = 'totp';
      user.backupCodes = JSON.stringify(hashedBackupCodes);
      user.twoFactorVerifiedAt = new Date();
      await this.userRepository.save(user);

      return true;
    }

    return false;
  }

  /**
   * Verify TOTP code during login
   */
  async verifyTotpCode(userId: string, code: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('2FA not enabled');
    }

    // Check if it's a backup code
    if (await this.verifyBackupCode(userId, code)) {
      return true;
    }

    // Verify TOTP code
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    return verified;
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Verify backup code
   */
  private async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.backupCodes) {
      return false;
    }

    const hashedCodes: string[] = JSON.parse(user.backupCodes);
    
    for (let i = 0; i < hashedCodes.length; i++) {
      const isValid = await bcrypt.compare(code, hashedCodes[i]);
      if (isValid) {
        // Remove used backup code
        hashedCodes.splice(i, 1);
        user.backupCodes = hashedCodes.length > 0 ? JSON.stringify(hashedCodes) : null;
        await this.userRepository.save(user);
        return true;
      }
    }

    return false;
  }

  /**
   * Send SMS verification code
   */
  async sendSmsCode(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.phoneNumber || !user.phoneVerified) {
      throw new BadRequestException('Phone number not verified');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store code temporarily (in production, use Redis with expiration)
    // For now, we'll use a simple in-memory store or database
    await this.smsService.sendVerificationCode(user.phoneNumber, code);
    
    // Store code in session or temporary storage
    // This should be stored with expiration (e.g., in Redis)
    // For this example, we'll assume a session service exists
  }

  /**
   * Send Email verification code
   */
  async sendEmailCode(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    await this.emailService.sendTwoFactorCode(user.email, code);
    
    // Store code in session or temporary storage
  }

  /**
   * Disable 2FA for user
   */
  async disableTwoFactor(userId: string, password: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Verify password before disabling
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorMethod = null;
    user.backupCodes = null;
    user.twoFactorVerifiedAt = null;
    await this.userRepository.save(user);
  }

  /**
   * Get backup codes (for display during setup)
   */
  async getBackupCodes(userId: string): Promise<string[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.backupCodes) {
      return [];
    }

    // Note: We can't retrieve the original codes, only generate new ones
    // This method should only be called during initial setup
    throw new BadRequestException('Backup codes can only be viewed during initial setup');
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled) {
      throw new BadRequestException('2FA not enabled');
    }

    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = await Promise.all(
      backupCodes.map(code => bcrypt.hash(code, 10))
    );

    user.backupCodes = JSON.stringify(hashedBackupCodes);
    await this.userRepository.save(user);

    return backupCodes;
  }
}
```

### 4. Update Email Service

**File**: `backend/src/auth/email.service.ts` (add method)

```typescript
async sendTwoFactorCode(email: string, code: string): Promise<void> {
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@omnimart.com',
    to: email,
    subject: 'Your OmniMart 2FA Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Two-Factor Authentication Code</h2>
        <p>Your verification code is:</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${code}
        </div>
        <p style="color: #666; font-size: 12px;">This code will expire in 10 minutes.</p>
        <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
      </div>
    `,
  };

  await this.transporter.sendMail(mailOptions);
}
```

### 5. Create 2FA DTOs

**File**: `backend/src/auth/dto/two-factor.dto.ts`

```typescript
import { IsString, IsNotEmpty, Length, Matches, IsOptional, IsIn } from 'class-validator';

export class EnableTwoFactorDto {
  @IsString()
  @IsNotEmpty()
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
  @Length(8)
  password: string;
}

export class RegenerateBackupCodesDto {
  @IsString()
  @IsNotEmpty()
  @Length(8)
  password: string;
}
```

### 6. Update Auth Service

**File**: `backend/src/auth/auth.service.ts` (modify `signIn` method)

```typescript
async signIn(dto: SignInDto) {
  const user = await this.userRepository.findOne({
    where: { email: dto.email },
  });

  if (!user) {
    throw new UnauthorizedException('Invalid credentials');
  }

  const isPasswordValid = await bcrypt.compare(dto.password, user.password);

  if (!isPasswordValid) {
    throw new UnauthorizedException('Invalid credentials');
  }

  // If 2FA is enabled, return a temporary token instead of access token
  if (user.twoFactorEnabled) {
    // Generate temporary token for 2FA verification (expires in 5 minutes)
    const tempToken = this.jwtService.sign(
      { 
        sub: user.id, 
        email: user.email,
        type: '2fa_verification',
        requires2FA: true 
      },
      { expiresIn: '5m' }
    );

    return {
      requires2FA: true,
      tempToken,
      method: user.twoFactorMethod,
      message: '2FA verification required',
    };
  }

  // Normal login flow
  const payload = { sub: user.id, email: user.email };
  const accessToken = this.jwtService.sign(payload);

  return {
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      userName: user.userName,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
  };
}

async verifyTwoFactorLogin(tempToken: string, code: string) {
  try {
    // Verify temporary token
    const payload = this.jwtService.verify(tempToken);
    
    if (payload.type !== '2fa_verification' || !payload.requires2FA) {
      throw new BadRequestException('Invalid token');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user || !user.twoFactorEnabled) {
      throw new BadRequestException('2FA not enabled');
    }

    // Verify 2FA code using TwoFactorService
    const twoFactorService = this.moduleRef.get(TwoFactorService);
    const isValid = await twoFactorService.verifyTotpCode(user.id, code);

    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    // Generate final access token
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        userName: user.userName,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw new BadRequestException('Invalid or expired token');
    }
    throw error;
  }
}
```

### 7. Update Auth Controller

**File**: `backend/src/auth/auth.controller.ts` (add routes)

```typescript
import { TwoFactorService } from './two-factor.service';
import {
  EnableTwoFactorDto,
  VerifyTwoFactorSetupDto,
  VerifyTwoFactorLoginDto,
  DisableTwoFactorDto,
  RegenerateBackupCodesDto,
} from './dto/two-factor.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  // ... existing routes ...

  @Post('signin')
  async signIn(@Body() dto: SignInDto) {
    return this.authService.signIn(dto);
  }

  @Post('verify-2fa')
  async verifyTwoFactorLogin(@Body() dto: { tempToken: string; code: string }) {
    return this.authService.verifyTwoFactorLogin(dto.tempToken, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable')
  async enableTwoFactor(@Request() req, @Body() dto: EnableTwoFactorDto) {
    if (dto.method === 'totp') {
      const result = await this.twoFactorService.generateTotpSecret(
        req.user.id,
        req.user.email,
      );
      return result;
    }
    throw new BadRequestException('Invalid 2FA method');
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/verify-setup')
  async verifyTwoFactorSetup(
    @Request() req,
    @Body() dto: VerifyTwoFactorSetupDto,
  ) {
    const isValid = await this.twoFactorService.verifyTotpSetup(
      req.user.id,
      dto.code,
    );
    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }
    return { message: '2FA enabled successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  async disableTwoFactor(@Request() req, @Body() dto: DisableTwoFactorDto) {
    await this.twoFactorService.disableTwoFactor(req.user.id, dto.password);
    return { message: '2FA disabled successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/regenerate-backup-codes')
  async regenerateBackupCodes(
    @Request() req,
    @Body() dto: RegenerateBackupCodesDto,
  ) {
    const codes = await this.twoFactorService.regenerateBackupCodes(req.user.id);
    return { backupCodes: codes };
  }

  @UseGuards(JwtAuthGuard)
  @Get('2fa/status')
  async getTwoFactorStatus(@Request() req) {
    const user = await this.authService.getProfile(req.user.id);
    return {
      enabled: user.twoFactorEnabled || false,
      method: user.twoFactorMethod || null,
    };
  }
}
```

### 8. Update Auth Module

**File**: `backend/src/auth/auth.module.ts`

```typescript
import { TwoFactorService } from './two-factor.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.register({
      // ... existing config
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, EmailService, SmsService, TwoFactorService],
  exports: [AuthService, TwoFactorService],
})
export class AuthModule {}
```

---

## Frontend Implementation

### 1. Update API Service

**File**: `frontend/src/services/api.ts` (add methods)

```typescript
// Add to authApi object
twoFactor: {
  enable: async (method: 'totp' | 'sms' | 'email') => {
    const response = await axios.post(`${API_URL}/auth/2fa/enable`, { method });
    return response.data;
  },
  
  verifySetup: async (code: string) => {
    const response = await axios.post(`${API_URL}/auth/2fa/verify-setup`, { code });
    return response.data;
  },
  
  verifyLogin: async (tempToken: string, code: string) => {
    const response = await axios.post(`${API_URL}/auth/verify-2fa`, { tempToken, code });
    return response.data;
  },
  
  disable: async (password: string) => {
    const response = await axios.post(`${API_URL}/auth/2fa/disable`, { password });
    return response.data;
  },
  
  regenerateBackupCodes: async (password: string) => {
    const response = await axios.post(`${API_URL}/auth/2fa/regenerate-backup-codes`, { password });
    return response.data;
  },
  
  getStatus: async () => {
    const response = await axios.get(`${API_URL}/auth/2fa/status`);
    return response.data;
  },
},
```

### 2. Update SignIn Component

**File**: `frontend/src/pages/SignIn.tsx`

```typescript
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAppDispatch } from '../store/hooks';
import { setCredentials } from '../store/slices/authSlice';
import { showToast } from '../utils/toast';

function SignIn() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorMethod, setTwoFactorMethod] = useState<'totp' | 'sms' | 'email'>('totp');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authApi.signIn(formData);
      
      // Check if 2FA is required
      if (response.requires2FA) {
        setRequires2FA(true);
        setTempToken(response.tempToken);
        setTwoFactorMethod(response.method || 'totp');
        showToast.info('Please enter your 2FA code');
      } else {
        // Normal login
        dispatch(setCredentials({ user: response.user, accessToken: response.accessToken }));
        showToast.success('Welcome back!');
        navigate('/');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Invalid email or password';
      setError(errorMessage);
      showToast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempToken) return;

    setError('');
    setLoading(true);

    try {
      const response = await authApi.twoFactor.verifyLogin(tempToken, twoFactorCode);
      dispatch(setCredentials({ user: response.user, accessToken: response.accessToken }));
      showToast.success('Welcome back!');
      navigate('/');
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Invalid 2FA code';
      setError(errorMessage);
      showToast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (requires2FA) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="glass-card rounded-2xl shadow-2xl p-8 space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-2">
                Two-Factor Authentication
              </h2>
              <p className="text-slate-400">
                Enter the code from your {twoFactorMethod === 'totp' ? 'authenticator app' : twoFactorMethod === 'sms' ? 'SMS' : 'email'}
              </p>
            </div>

            <form className="space-y-6" onSubmit={handle2FAVerify}>
              {error && (
                <div className="bg-red-500/10 border-l-4 border-red-500 text-red-200 px-4 py-3 rounded">
                  <p className="font-medium">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  className="w-full px-4 py-3 glass-card rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all text-center text-2xl tracking-widest"
                  placeholder="000000"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              <button
                type="submit"
                disabled={loading || twoFactorCode.length < 4}
                className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setRequires2FA(false);
                  setTempToken(null);
                  setTwoFactorCode('');
                }}
                className="w-full text-sm text-slate-400 hover:text-slate-300"
              >
                Back to login
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ... existing login form ...
}
```

### 3. Create 2FA Settings Component

**File**: `frontend/src/pages/SecuritySettings.tsx`

```typescript
import { useState, useEffect } from 'react';
import { authApi } from '../services/api';
import { showToast } from '../utils/toast';

function SecuritySettings() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [setupStep, setSetupStep] = useState<'idle' | 'qr' | 'verify' | 'backup'>('idle');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [password, setPassword] = useState('');

  useEffect(() => {
    load2FAStatus();
  }, []);

  const load2FAStatus = async () => {
    try {
      const status = await authApi.twoFactor.getStatus();
      setTwoFactorEnabled(status.enabled);
      setTwoFactorMethod(status.method);
    } catch (error) {
      console.error('Failed to load 2FA status:', error);
    }
  };

  const handleEnable2FA = async () => {
    setLoading(true);
    try {
      const result = await authApi.twoFactor.enable('totp');
      setQrCodeUrl(result.qrCodeUrl);
      setSetupStep('qr');
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Failed to enable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.twoFactor.verifySetup(verificationCode);
      setSetupStep('backup');
      // Fetch backup codes (they should be returned from verify-setup)
      showToast.success('2FA enabled successfully!');
      load2FAStatus();
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      showToast.error('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      await authApi.twoFactor.disable(password);
      showToast.success('2FA disabled successfully');
      setTwoFactorEnabled(false);
      setTwoFactorMethod(null);
      setPassword('');
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-white mb-8">Security Settings</h1>

      <div className="glass-card rounded-xl p-6 mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Two-Factor Authentication</h2>
        
        {!twoFactorEnabled ? (
          <div>
            <p className="text-slate-400 mb-4">
              Add an extra layer of security to your account by enabling two-factor authentication.
            </p>
            
            {setupStep === 'idle' && (
              <button
                onClick={handleEnable2FA}
                disabled={loading}
                className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? 'Setting up...' : 'Enable 2FA'}
              </button>
            )}

            {setupStep === 'qr' && (
              <div className="space-y-4">
                <p className="text-slate-300">Scan this QR code with your authenticator app:</p>
                <div className="flex justify-center">
                  <img src={qrCodeUrl} alt="QR Code" className="bg-white p-4 rounded-lg" />
                </div>
                <form onSubmit={handleVerifySetup} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Enter verification code
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      className="w-full px-4 py-3 glass-card rounded-xl text-white text-center text-2xl tracking-widest"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || verificationCode.length !== 6}
                    className="w-full px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50"
                  >
                    Verify & Enable
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-green-400 font-semibold">2FA is enabled</p>
                <p className="text-slate-400 text-sm">Method: {twoFactorMethod?.toUpperCase()}</p>
              </div>
            </div>
            
            <form onSubmit={handleDisable2FA} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Enter your password to disable 2FA
                </label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-3 glass-card rounded-xl text-white"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Disabling...' : 'Disable 2FA'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default SecuritySettings;
```

---

## Security Considerations

### 1. Rate Limiting
- Implement rate limiting on 2FA verification endpoints
- Limit failed attempts (e.g., 5 attempts per 15 minutes)
- Lock account after multiple failed attempts

### 2. Token Expiration
- Temporary 2FA tokens should expire quickly (5-10 minutes)
- Backup codes should be single-use
- Store codes securely (hashed for backup codes)

### 3. Session Management
- Use secure, HttpOnly cookies for session tokens
- Implement proper session invalidation
- Consider using Redis for temporary code storage

### 4. Code Storage
- Never store TOTP secrets in plain text
- Use environment variables for sensitive configuration
- Encrypt backup codes before storing

### 5. User Experience
- Provide clear instructions for setup
- Show backup codes only once during setup
- Allow users to regenerate backup codes
- Provide recovery options

### 6. Monitoring
- Log 2FA attempts (successful and failed)
- Monitor for suspicious patterns
- Alert on multiple failed attempts

---

## Step-by-Step Implementation

### Phase 1: Database Setup
1. Run SQL migration to add 2FA columns to users table
2. Optionally create two_factor_sessions table
3. Update User entity with new fields

### Phase 2: Backend Core
1. Install dependencies (`speakeasy`, `qrcode`)
2. Create `TwoFactorService`
3. Update `EmailService` with 2FA email method
4. Create 2FA DTOs
5. Update `AuthService` signIn method
6. Add 2FA routes to `AuthController`
7. Update `AuthModule` to include `TwoFactorService`

### Phase 3: Frontend Integration
1. Update API service with 2FA methods
2. Modify SignIn component to handle 2FA flow
3. Create SecuritySettings component
4. Add route for security settings page

### Phase 4: Testing
1. Test TOTP setup flow
2. Test 2FA login flow
3. Test backup codes
4. Test disable 2FA
5. Test error handling

### Phase 5: Production Readiness
1. Implement rate limiting
2. Set up Redis for code storage (if needed)
3. Add monitoring and logging
4. Update documentation
5. Security audit

---

## Testing

### Manual Testing Checklist

#### TOTP Setup
- [ ] User can enable 2FA
- [ ] QR code is displayed correctly
- [ ] QR code can be scanned by authenticator app
- [ ] Verification code is accepted
- [ ] Backup codes are generated and displayed
- [ ] 2FA status is updated after setup

#### 2FA Login
- [ ] User with 2FA enabled is prompted for code
- [ ] Valid TOTP code is accepted
- [ ] Invalid TOTP code is rejected
- [ ] Backup code can be used
- [ ] Used backup code cannot be reused
- [ ] Temporary token expires correctly

#### Disable 2FA
- [ ] User can disable 2FA with password
- [ ] Invalid password is rejected
- [ ] 2FA status is updated after disable

#### Edge Cases
- [ ] Expired temporary token
- [ ] Multiple failed attempts
- [ ] Network errors during setup
- [ ] Invalid QR code scan

### Test Data

```typescript
// Example test cases
describe('TwoFactorService', () => {
  it('should generate TOTP secret', async () => {
    // Test implementation
  });

  it('should verify TOTP code', async () => {
    // Test implementation
  });

  it('should reject invalid TOTP code', async () => {
    // Test implementation
  });
});
```

---

## Additional Resources

- [RFC 6238 - TOTP Specification](https://tools.ietf.org/html/rfc6238)
- [OWASP 2FA Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)
- [Speakeasy Documentation](https://github.com/speakeasyjs/speakeasy)
- [QR Code Generation](https://github.com/soldair/node-qrcode)

---

## Notes

- This implementation focuses on TOTP as the primary method
- SMS and Email 2FA can be added using similar patterns
- Consider implementing a recovery flow for lost devices
- Backup codes should be shown only once and stored securely
- In production, use Redis or similar for temporary code storage
- Consider implementing "Remember this device" feature (30-day exemption)

---

**Last Updated**: 2024
**Version**: 1.0

