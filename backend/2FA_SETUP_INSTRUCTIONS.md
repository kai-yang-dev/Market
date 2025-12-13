# 2FA Setup Instructions

## 1. Install Required Dependencies

Before running the application, install the required npm packages:

```bash
cd backend
npm install speakeasy qrcode
npm install --save-dev @types/speakeasy @types/qrcode
```

## 2. Run Database Migration

Execute the SQL migration to add 2FA fields to the users table:

```bash
# Using MySQL command line
mysql -u your_username -p your_database < add-2fa-to-users-table.sql

# Or using your database management tool, run the contents of:
# backend/add-2fa-to-users-table.sql
```

## 3. Environment Variables

Make sure your `.env` file has the following variables configured (if using email/SMS 2FA):

```
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_FROM=noreply@omnimart.com
```

## 4. Frontend Route (Optional)

If you want to add a route for the Security Settings page, add it to your router:

```typescript
// In your router configuration
import SecuritySettings from './pages/SecuritySettings';

// Add route
{
  path: '/settings/security',
  element: <SecuritySettings />,
  // Add authentication guard if needed
}
```

## 5. Testing

1. Start the backend server
2. Start the frontend server
3. Sign in to your account
4. Navigate to Security Settings (if route is configured)
5. Enable 2FA by scanning the QR code with an authenticator app
6. Test login with 2FA enabled

## Notes

- TOTP codes are time-based and expire every 30 seconds
- Backup codes are single-use and should be stored securely
- The temporary 2FA verification token expires in 5 minutes
- In production, consider using Redis for storing temporary verification codes instead of in-memory storage

