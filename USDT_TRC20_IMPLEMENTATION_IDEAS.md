# USDT TRC20 Charge & Withdraw System Implementation Ideas

## Overview
This document outlines comprehensive ideas for implementing a USDT TRC20 token-based charge and withdraw system, similar to real banking systems, with automated wallet management and transaction monitoring.

---

## 1. System Architecture

### 1.1 Core Components

#### **Frontend Components**
- **Charge Balance Page**: Simplified UI showing current balance and amount input
- **Withdraw Balance Page**: Input for withdrawal amount and destination address
- **Transaction Status Page**: Real-time status updates for pending transactions
- **QR Code Generator**: Display wallet address as QR code for easy scanning

#### **Backend Services**
- **Wallet Service**: Manages temporary TRC20 wallets per user
- **Blockchain Monitor Service**: Monitors wallet addresses for incoming transactions
- **Transaction Service**: Handles charge and withdraw operations
- **Fee Calculation Service**: Calculates gas fees and platform fees

#### **Database Entities**
- **TempWallet Entity**: Stores temporary wallet addresses per user
- **Transaction Entity**: Enhanced with wallet tracking fields
- **Balance Entity**: User balance management

---

## 2. Charge Balance Flow

### 2.1 User Flow

1. **User Input**
   - User enters desired amount (USDT)
   - System validates minimum amount (e.g., $10 + fees)
   - System calculates total required: `amount + gas_fee + platform_fee($1)`

2. **Wallet Generation/Retrieval**
   - Backend checks if user has existing active temp wallet
   - If exists: Reuse wallet address
   - If not: Generate new TRC20 wallet using TronWeb or similar library
   - Store wallet info: `userId`, `address`, `privateKey` (encrypted), `status`, `createdAt`

3. **Display Payment Information**
   - Show wallet address (with copy button)
   - Display QR code for wallet address
   - Show breakdown:
     - Amount to send: `X USDT`
     - Gas fee estimate: `~Y TRX` (converted to USDT)
     - Platform fee: `$5 USDT`
     - Total required: `X + Y + 1 USDT`
   - Show transaction status: "Waiting for payment..."
   - Create transaction record with status: `PENDING`

4. **Blockchain Monitoring**
   - Background service polls wallet address every 30-60 seconds
   - Alternative: Use TronGrid webhooks (if available) for real-time updates
   - Check for USDT (TRC20) transfers to the wallet address
   - Verify:
     - Amount matches (within tolerance, e.g., ±0.01 USDT)
     - Token contract address matches USDT TRC20 contract
     - Transaction is confirmed (at least 1 confirmation)

5. **Balance Update**
   - When payment detected:
     - Update transaction status to `SUCCESS`
     - Credit user balance: `amount` (excluding fees)
     - Update temp wallet status to `COMPLETED` or keep active for future use
     - Send notification to user (email/push/in-app)
     - Update UI in real-time via WebSocket or polling

6. **Timeout Handling**
   - If no payment received within 24 hours:
     - Mark transaction as `EXPIRED` or `CANCELLED`
     - Optionally keep wallet active for future use
     - Allow user to retry with same wallet

### 2.2 Technical Implementation

#### **Wallet Generation**
```typescript
// Using TronWeb library
import TronWeb from 'tronweb';

async generateTempWallet(userId: string): Promise<TempWallet> {
  // Check existing wallet
  const existing = await this.tempWalletRepository.findOne({
    where: { userId, status: 'ACTIVE' }
  });
  
  if (existing) {
    return existing;
  }
  
  // Generate new wallet
  const account = TronWeb.utils.accounts.generateAccount();
  
  const tempWallet = this.tempWalletRepository.create({
    userId,
    address: account.address.base58,
    privateKey: encrypt(account.privateKey), // Encrypt before storing
    status: 'ACTIVE',
    createdAt: new Date()
  });
  
  return await this.tempWalletRepository.save(tempWallet);
}
```

#### **Blockchain Monitoring**
```typescript
// Monitor wallet for incoming USDT
async monitorWallet(walletAddress: string, expectedAmount: number) {
  const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io'
  });
  
  const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // USDT TRC20
  
  // Get recent transactions
  const transactions = await tronWeb.trx.getTransactionsFromAddress(
    walletAddress,
    50
  );
  
  // Filter for USDT transfers
  for (const tx of transactions) {
    if (tx.contract && tx.contract[0].parameter.value.contract_address === USDT_CONTRACT) {
      const amount = tx.contract[0].parameter.value.amount / 1e6; // USDT has 6 decimals
      if (Math.abs(amount - expectedAmount) < 0.01) {
        return { success: true, transactionHash: tx.txID, amount };
      }
    }
  }
  
  return { success: false };
}
```

---

## 3. Withdraw Balance Flow

### 3.1 User Flow

1. **User Input**
   - User enters withdrawal amount
   - User enters destination TRC20 wallet address
   - System validates:
     - Sufficient balance (amount + gas fee + platform fee)
     - Valid TRC20 address format
     - Address is not a contract address (optional check)

2. **Fee Calculation**
   - Gas fee: ~10-20 TRX (varies with network)
   - Platform fee: $5 USDT (fixed)
   - Total deduction: `amount + gas_fee + platform_fee`
   - Display breakdown to user

3. **Balance Check & Deduction**
   - Verify user has sufficient balance
   - Create transaction record with status: `PENDING`
   - Lock balance (deduct from available balance)
   - Keep transaction in pending state

4. **Blockchain Transaction**
   - Use temp wallet's private key to sign transaction
   - Send USDT from temp wallet to user's destination address
   - Include gas fee (TRX) for transaction
   - Wait for transaction confirmation

5. **Transaction Confirmation**
   - Monitor transaction on blockchain
   - Once confirmed (1+ confirmations):
     - Update transaction status to `SUCCESS`
     - Permanently deduct from user balance
     - Send notification to user
   - If failed:
     - Update transaction status to `FAILED`
     - Refund locked balance to user
     - Notify user of failure

### 3.2 Technical Implementation

#### **Withdraw Execution**
```typescript
async executeWithdraw(
  userId: string,
  amount: number,
  destinationAddress: string
): Promise<Transaction> {
  // Get user's temp wallet
  const tempWallet = await this.getTempWallet(userId);
  
  // Calculate fees
  const platformFee = 5; // $1 USDT
  const gasFee = await this.estimateGasFee();
  const totalDeduction = amount + platformFee;
  
  // Check balance
  const balance = await this.getBalance(userId);
  if (balance.amount < totalDeduction) {
    throw new InsufficientBalanceException();
  }
  
  // Create transaction
  const transaction = await this.createTransaction({
    userId,
    type: 'withdraw',
    amount,
    destinationAddress,
    status: 'PENDING'
  });
  
  // Lock balance
  await this.lockBalance(userId, totalDeduction);
  
  try {
    // Execute blockchain transaction
    const tronWeb = new TronWeb({
      fullHost: 'https://api.trongrid.io',
      privateKey: decrypt(tempWallet.privateKey)
    });
    
    const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
    const contract = await tronWeb.contract().at(USDT_CONTRACT);
    
    // Transfer USDT
    const result = await contract.transfer(
      destinationAddress,
      amount * 1e6 // Convert to smallest unit
    ).send();
    
    // Update transaction
    transaction.status = 'SUCCESS';
    transaction.transactionHash = result;
    await this.transactionRepository.save(transaction);
    
    // Deduct balance permanently
    await this.deductBalance(userId, totalDeduction);
    
    return transaction;
  } catch (error) {
    // Refund on failure
    transaction.status = 'FAILED';
    await this.transactionRepository.save(transaction);
    await this.unlockBalance(userId, totalDeduction);
    throw error;
  }
}
```

---

## 4. Database Schema

### 4.1 TempWallet Entity

```typescript
@Entity('temp_wallets')
export class TempWallet extends BaseEntity {
  @Column({ name: 'user_id', unique: true })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'address', unique: true })
  address: string; // TRC20 wallet address

  @Column({ name: 'private_key', type: 'text' })
  privateKey: string; // Encrypted private key

  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'COMPLETED', 'INACTIVE'],
    default: 'ACTIVE'
  })
  status: string;

  @Column({ name: 'last_checked_at', nullable: true })
  lastCheckedAt?: Date;

  @Column({ name: 'total_received', type: 'decimal', default: 0 })
  totalReceived: number;
}
```

### 4.2 Enhanced Transaction Entity

```typescript
// Add to existing Transaction entity:
@Column({ name: 'temp_wallet_id', nullable: true })
tempWalletId?: string;

@ManyToOne(() => TempWallet, { nullable: true })
@JoinColumn({ name: 'temp_wallet_id' })
tempWallet?: TempWallet;

@Column({ name: 'expected_amount', type: 'decimal', nullable: true })
expectedAmount?: number; // For charge transactions

@Column({ name: 'gas_fee', type: 'decimal', nullable: true })
gasFee?: number;

@Column({ name: 'platform_fee', type: 'decimal', nullable: true })
platformFee?: number;

@Column({ name: 'expires_at', nullable: true })
expiresAt?: Date; // For pending charge transactions
```

---

## 5. Security Considerations

### 5.1 Private Key Management

- **Encryption**: Store private keys encrypted at rest
  - Use AES-256 encryption
  - Store encryption key in environment variables or key management service
  - Never log private keys

- **Key Rotation**: Consider rotating temp wallets periodically
  - After each successful charge, optionally create new wallet
  - Or keep same wallet for user convenience

- **Access Control**: Limit access to private keys
  - Only wallet service should decrypt keys
  - Use role-based access control

### 5.2 Transaction Security

- **Amount Validation**: Verify received amount matches expected amount
- **Double Spending Prevention**: Check transaction hash uniqueness
- **Rate Limiting**: Limit charge/withdraw requests per user
- **Address Validation**: Validate TRC20 addresses before processing
- **Confirmation Requirements**: Wait for at least 1 blockchain confirmation

### 5.3 Monitoring & Alerts

- **Anomaly Detection**: Alert on unusual transaction patterns
- **Balance Monitoring**: Monitor temp wallet balances
- **Failed Transaction Alerts**: Notify admins of failed withdrawals
- **Gas Price Monitoring**: Track gas prices for optimal transaction timing

---

## 6. Background Services

### 6.1 Wallet Monitor Service

```typescript
@Injectable()
export class WalletMonitorService {
  // Run every 30-60 seconds
  @Cron('*/30 * * * * *')
  async monitorPendingCharges() {
    const pendingTransactions = await this.transactionRepository.find({
      where: {
        type: 'charge',
        status: 'PENDING',
        expiresAt: MoreThan(new Date())
      },
      relations: ['tempWallet']
    });

    for (const transaction of pendingTransactions) {
      const result = await this.checkWalletPayment(
        transaction.tempWallet.address,
        transaction.expectedAmount
      );

      if (result.success) {
        await this.completeCharge(transaction.id, result);
      }
    }
  }

  // Check expired transactions
  @Cron('0 * * * *') // Every hour
  async expireOldTransactions() {
    await this.transactionRepository.update(
      {
        status: 'PENDING',
        expiresAt: LessThan(new Date())
      },
      { status: 'EXPIRED' }
    );
  }
}
```

### 6.2 Gas Fee Estimation Service

```typescript
@Injectable()
export class GasFeeService {
  async estimateGasFee(): Promise<number> {
    // Get current TRX price in USDT
    const trxPrice = await this.getTRXPrice();
    
    // Estimate gas needed (typically 10-20 TRX for USDT transfer)
    const estimatedTRX = 15; // Conservative estimate
    
    return estimatedTRX * trxPrice; // Convert to USDT
  }

  async getTRXPrice(): Promise<number> {
    // Fetch from exchange API or use fixed rate
    // Example: Binance API, CoinGecko, etc.
  }
}
```

---

## 7. Frontend Enhancements

### 7.1 Charge Balance UI

```typescript
// Simplified Charge UI
- Current Balance Display (large, prominent)
- Amount Input (USDT)
- "Charge Balance" Button
- After clicking:
  - Show loading state
  - Display:
    - Wallet Address (with copy button)
    - QR Code
    - Amount breakdown:
      * Amount: X USDT
      * Gas Fee: ~Y USDT
      * Platform Fee: $5 USDT
      * Total: X + Y + 1 USDT
    - Transaction Status (real-time updates)
    - Countdown timer (if expires in 24h)
```

### 7.2 Real-time Updates

- **WebSocket Connection**: Connect to backend for real-time transaction updates
- **Polling Fallback**: If WebSocket unavailable, poll every 5-10 seconds
- **Status Indicators**: Visual feedback for pending/success/failed states

### 7.3 QR Code Generation

```typescript
import QRCode from 'qrcode';

// Generate QR code for wallet address
const qrCodeDataURL = await QRCode.toDataURL(walletAddress, {
  width: 300,
  margin: 2
});
```

---

## 8. API Endpoints

### 8.1 Charge Endpoints

```
POST /payment/charge/initiate
Body: { amount: number }
Response: {
  walletAddress: string,
  qrCode: string,
  amount: number,
  gasFee: number,
  platformFee: number,
  total: number,
  transactionId: string,
  expiresAt: string
}

GET /payment/charge/status/:transactionId
Response: {
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED',
  transactionHash?: string,
  confirmedAt?: string
}
```

### 8.2 Withdraw Endpoints

```
POST /payment/withdraw
Body: {
  amount: number,
  walletAddress: string
}
Response: {
  transactionId: string,
  status: 'PENDING',
  estimatedGasFee: number,
  platformFee: number,
  totalDeduction: number
}

GET /payment/withdraw/status/:transactionId
Response: {
  status: 'PENDING' | 'SUCCESS' | 'FAILED',
  transactionHash?: string,
  confirmedAt?: string
}
```

### 8.3 Wallet Endpoints

```
GET /payment/wallet/temp
Response: {
  address: string,
  qrCode: string,
  status: string
}
```

---

## 9. Error Handling

### 9.1 Common Scenarios

- **Insufficient Gas**: Temp wallet doesn't have enough TRX for withdrawal
  - Solution: Maintain minimum TRX balance in temp wallets
  - Auto-refill mechanism from main platform wallet

- **Network Congestion**: High gas prices or slow confirmations
  - Solution: Allow user to cancel and retry
  - Show estimated confirmation time

- **Wrong Amount Sent**: User sends different amount than expected
  - Solution: Accept if within tolerance (±0.01 USDT)
  - Credit exact amount received (minus fees)
  - Notify user of discrepancy

- **Expired Transaction**: No payment received within 24 hours
  - Solution: Allow user to retry with same wallet
  - Keep wallet active for convenience

- **Failed Withdrawal**: Transaction fails on blockchain
  - Solution: Automatically refund locked balance
  - Notify user with error details
  - Allow retry

---

## 10. Additional Features

### 10.1 Multi-Wallet Support

- Allow users to have multiple temp wallets
- Useful for tracking different charge transactions
- Each wallet can have a label/description

### 10.2 Transaction History

- Enhanced transaction history with:
  - Wallet addresses used
  - Gas fees paid
  - Platform fees
  - Blockchain explorer links
  - Transaction confirmations count

### 10.3 Notifications

- Email notifications for:
  - Payment received
  - Withdrawal completed
  - Transaction failed
  - Transaction expired

- In-app notifications via WebSocket
- Push notifications (if mobile app)

### 10.4 Admin Dashboard

- View all temp wallets
- Monitor pending transactions
- View wallet balances
- Manual transaction processing (if needed)
- Analytics: total charges, withdrawals, fees collected

---

## 11. Testing Strategy

### 11.1 Unit Tests

- Wallet generation
- Fee calculations
- Balance operations
- Transaction status updates

### 11.2 Integration Tests

- End-to-end charge flow
- End-to-end withdraw flow
- Blockchain interaction (use testnet)
- Database transactions

### 11.3 Testnet Deployment

- Deploy to Tron Shasta testnet first
- Test all flows with test USDT
- Verify gas fee calculations
- Test error scenarios

---

## 12. Deployment Considerations

### 12.1 Environment Variables

```
TRON_NETWORK=mainnet|shasta
TRON_FULL_NODE=https://api.trongrid.io
USDT_CONTRACT_ADDRESS=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
WALLET_ENCRYPTION_KEY=<encryption-key>
PLATFORM_FEE=1
MIN_CHARGE_AMOUNT=10
```

### 12.2 Infrastructure

- **Database**: PostgreSQL/MySQL for transaction records
- **Cache**: Redis for temporary data and rate limiting
- **Queue**: Bull/BullMQ for background jobs
- **Monitoring**: Prometheus + Grafana for metrics
- **Logging**: Winston or similar for structured logs

### 12.3 Scalability

- **Horizontal Scaling**: Multiple backend instances
- **Database Sharding**: If handling millions of transactions
- **Caching**: Cache wallet addresses and balances
- **Load Balancing**: Distribute blockchain API calls

---

## 13. Compliance & Legal

### 13.1 KYC/AML

- Consider implementing KYC for large transactions
- Transaction limits per user
- Suspicious activity reporting

### 13.2 Terms of Service

- Clear terms about fees
- Refund policy
- Transaction processing times
- Liability disclaimers

---

## 14. Future Enhancements

### 14.1 Multi-Chain Support

- Support other chains (BSC, Ethereum, Polygon)
- Let users choose preferred network

### 14.2 Automated Market Making

- Convert between different cryptocurrencies
- Provide liquidity pools

### 14.3 Staking/Rewards

- Allow users to stake USDT for rewards
- Interest-bearing accounts

### 14.4 Payment Links

- Generate payment links for charges
- Shareable QR codes
- Invoice generation

---

## 15. Implementation Priority

### Phase 1: Core Functionality
1. Temp wallet generation
2. Charge flow with monitoring
3. Basic withdraw flow
4. Database schema

### Phase 2: Enhanced Features
1. Real-time updates (WebSocket)
2. QR code generation
3. Fee calculations
4. Error handling

### Phase 3: Polish & Optimization
1. Admin dashboard
2. Notifications
3. Analytics
4. Performance optimization

### Phase 4: Advanced Features
1. Multi-wallet support
2. Payment links
3. Advanced monitoring
4. Compliance features

---

## Conclusion

This implementation provides a robust, secure, and user-friendly system for USDT TRC20 charge and withdraw operations. The key is maintaining security around private keys, reliable blockchain monitoring, and clear user communication throughout the process.

The system balances automation (like real banking) with transparency (blockchain visibility), giving users confidence while reducing manual intervention.

