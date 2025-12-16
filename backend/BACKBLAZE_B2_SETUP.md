# Backblaze B2 Storage Setup Guide

This guide will help you set up Backblaze B2 cloud storage for file uploads in this application.

## Prerequisites

1. A Backblaze account (sign up at https://www.backblaze.com/)
2. Access to your backend `.env` file

## Step 1: Create a Backblaze B2 Bucket

1. Log in to your Backblaze account
2. Navigate to **B2 Cloud Storage** → **Buckets**
3. Click **Create a Bucket**
4. Configure your bucket:
   - **Bucket Name**: Choose a unique name (e.g., `your-app-name-files`)
   - **Files in Bucket are**: Select **Public** (for public file access)
   - **Default Encryption**: Choose your preference (Server-Side Encryption recommended)
   - **Object Lock**: Leave disabled unless you need it
5. Click **Create a Bucket**
6. **Save the Bucket ID** - you'll need it for configuration

## Step 2: Create Application Keys

1. Navigate to **B2 Cloud Storage** → **App Keys**
2. Click **Add a New Application Key**
3. Configure the key:
   - **Name**: `your-app-name-storage` (or any descriptive name)
   - **Allow access to Bucket(s)**: Select your bucket name
   - **Type of Access**: Select **Read and Write**
   - **Allow List All Bucket Names**: Leave unchecked (unless needed)
   - **File name prefix**: Leave empty (unless you want to restrict access)
   - **Duration**: Leave empty for permanent key
4. Click **Create New Key**
5. **IMPORTANT**: Copy and save:
   - **keyID** (Application Key ID)
   - **applicationKey** (Application Key) - This is shown only once!

## Step 3: Get Your Public URL

1. Navigate to **B2 Cloud Storage** → **Buckets**
2. Click on your bucket name
3. Find the **Friendly URL** or **Public URL** - it will look like:
   - `https://f000.backblazeb2.com/file/your-bucket-name/`
   - OR if you set up a custom domain: `https://your-domain.com/`
4. **Save this URL** - you'll need it for configuration

## Step 4: Configure Environment Variables

Add the following variables to your `backend/.env` file:

```env
# Backblaze B2 Configuration
B2_APPLICATION_KEY_ID=your_application_key_id_here
B2_APPLICATION_KEY=your_application_key_here
B2_BUCKET_ID=your_bucket_id_here
B2_BUCKET_NAME=your-bucket-name
B2_PUBLIC_URL=https://f000.backblazeb2.com/file/your-bucket-name
```

### Example:

```env
B2_APPLICATION_KEY_ID=003abc123def4567890123456789abcdef0000000001
B2_APPLICATION_KEY=K001abcdefghijklmnopqrstuvwxyz1234567890
B2_BUCKET_ID=abc123def4567890123456789
B2_BUCKET_NAME=my-marketplace-files
B2_PUBLIC_URL=https://f000.backblazeb2.com/file/my-marketplace-files
```

## Step 5: Verify Configuration

1. Make sure all environment variables are set correctly
2. Restart your backend server
3. Try uploading a file through your application
4. Check the Backblaze B2 dashboard to verify the file was uploaded

## File Organization

Files are organized in folders within your B2 bucket:
- **services/** - Service advertisement images
- **posts/** - Blog post images
- **categories/** - Category images (if implemented)

## Troubleshooting

### Error: "Failed to authorize Backblaze B2"
- Check that `B2_APPLICATION_KEY_ID` and `B2_APPLICATION_KEY` are correct
- Ensure there are no extra spaces or quotes in your `.env` file
- Verify your application key has the correct permissions

### Error: "Failed to upload file"
- Check that `B2_BUCKET_ID` matches your bucket
- Verify your application key has write access to the bucket
- Check that the bucket exists and is accessible

### Files not accessible via public URL
- Ensure your bucket is set to **Public**
- Verify `B2_PUBLIC_URL` is correct
- Check that the file path in the URL matches the folder structure

### Files uploaded but URLs are incorrect
- Verify `B2_PUBLIC_URL` includes the correct bucket name
- Check that the URL format matches: `https://f000.backblazeb2.com/file/bucket-name/`

## Security Best Practices

1. **Never commit your `.env` file** to version control
2. **Rotate your application keys** periodically
3. **Use bucket-level restrictions** if you don't need public access
4. **Monitor your usage** in the Backblaze dashboard
5. **Set up billing alerts** to avoid unexpected charges

## Cost Information

Backblaze B2 pricing (as of 2025):
- **Storage**: $0.005 per GB/month (extremely cheap!)
- **Download**: First 1 GB/day FREE, then $0.01 per GB
- **Upload**: FREE
- **Free Tier**: 10 GB storage forever

Example monthly costs:
- 50 GB storage, 30 GB downloads: ~$0.25/month
- 200 GB storage, 100 GB downloads: ~$1.70/month
- 1 TB storage, 500 GB downloads: ~$9.70/month

## Additional Resources

- [Backblaze B2 Documentation](https://www.backblaze.com/b2/docs/)
- [B2 API Reference](https://www.backblaze.com/b2/docs/api_reference.html)
- [B2 SDK for Node.js](https://www.npmjs.com/package/backblaze-b2)

## Support

If you encounter issues:
1. Check the Backblaze B2 dashboard for errors
2. Review the backend logs for detailed error messages
3. Verify all environment variables are set correctly
4. Consult the Backblaze B2 documentation

