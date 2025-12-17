import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { EmailService } from './email.service';
// import { SmsService } from './sms.service'; // SMS phone verification disabled

@Injectable()
export class TwoFactorService {
  // In-memory store for SMS/Email codes (in production, use Redis)
  private verificationCodes = new Map<string, { code: string; expires: Date }>();

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private emailService: EmailService,
    // private smsService: SmsService, // SMS phone verification disabled
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
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');

    return {
      secret: secret.base32,
      qrCodeUrl,
    };
  }

  /**
   * Verify TOTP code during setup
   */
  async verifyTotpSetup(userId: string, code: string): Promise<{ backupCodes: string[] }> {
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

    if (!verified) {
      throw new BadRequestException('Invalid verification code');
    }

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

    return { backupCodes };
  }

  /**
   * Verify TOTP code during login
   */
  async verifyTotpCode(userId: string, code: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled) {
      throw new BadRequestException('2FA not enabled');
    }

    // Check if it's a backup code first
    if (await this.verifyBackupCode(userId, code)) {
      return true;
    }

    // If TOTP method, verify TOTP code
    if (user.twoFactorMethod === 'totp' && user.twoFactorSecret) {
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: code,
        window: 2,
      });
      return verified;
    }

    // SMS phone verification disabled - removed 'sms' from condition
    // If Email method, verify stored code
    if (/* user.twoFactorMethod === 'sms' || */ user.twoFactorMethod === 'email') {
      const storedCode = this.verificationCodes.get(userId);
      if (!storedCode) {
        return false;
      }
      if (new Date() > storedCode.expires) {
        this.verificationCodes.delete(userId);
        return false;
      }
      if (storedCode.code !== code) {
        return false;
      }
      // Code is valid, remove it
      this.verificationCodes.delete(userId);
      return true;
    }

    return false;
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

  /* SMS phone verification disabled - sendSmsCode method commented out
  /**
   * Send SMS verification code
   */
  /*
  async sendSmsCode(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.phoneNumber || !user.phoneVerified) {
      throw new BadRequestException('Phone number not verified');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

    // Store code
    this.verificationCodes.set(userId, { code, expires: expiresAt });
    
    await this.smsService.sendVerificationCode(user.phoneNumber, code);
  }
  */

  /**
   * Send Email verification code
   */
  async sendEmailCode(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

    // Store code
    this.verificationCodes.set(userId, { code, expires: expiresAt });
    
    await this.emailService.sendTwoFactorCode(user.email, code);
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

    // Remove any stored verification codes
    this.verificationCodes.delete(userId);
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string, password: string): Promise<string[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled) {
      throw new BadRequestException('2FA not enabled');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
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

