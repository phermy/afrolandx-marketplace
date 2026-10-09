import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import sharp from 'sharp';
import { optimizeProductImage } from './product-image-processing';

interface CloudStorageConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucketName: string;
  endpoint?: string;
}

export class CloudStorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;

  constructor(config: CloudStorageConfig & { sessionToken?: string }) {
    const credentials: any = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    };

    // Add session token if provided (required for temporary credentials)
    if (config.sessionToken) {
      credentials.sessionToken = config.sessionToken;
    }

    this.s3Client = new S3Client({
      region: config.region,
      credentials,
      endpoint: config.endpoint,
      forcePathStyle: true, // Required for some S3-compatible services
    });
    this.bucketName = config.bucketName;
    this.region = config.region;
  }

  async checkConnection(): Promise<{ connectionReady: boolean; status: string }> {
    try {
      // Read-only check. This does not claim that uploads or public reads passed.
      await this.s3Client.send(new ListObjectsV2Command({ Bucket: this.bucketName, MaxKeys: 0 }));
      return { connectionReady: true, status: "Storage connection verified. Upload and image delivery still need testing." };
    } catch (error: any) {
      const credentialsInvalid = ["InvalidToken", "ExpiredToken", "InvalidAccessKeyId", "SignatureDoesNotMatch"].includes(error?.name);
      return { connectionReady: false, status: credentialsInvalid
        ? "Storage credentials are invalid or expired. Update the matching access key, secret key and session token securely."
        : "Could not verify storage access. Check the bucket, region and permissions." };
    }
  }

  async uploadImage(buffer: Buffer, contentType: string, folder: string = 'products'): Promise<string> {
    try {
      // Product images retain detail up to 2400px; profile images keep their
      // existing 1600px limit and independent upload policy.
      const optimizedBuffer = folder === 'products'
        ? await optimizeProductImage(buffer)
        : await sharp(buffer)
          .rotate()
          .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
          .normalize()
          .sharpen({ sigma: 0.7 })
          .jpeg({ quality: 90, progressive: true, mozjpeg: true })
          .toBuffer();

      // Generate unique filename
      const hash = crypto.randomBytes(16).toString('hex');
      const filename = `${folder}/${Date.now()}-${hash}.jpg`;

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: filename,
        Body: optimizedBuffer,
        ContentType: 'image/jpeg',
        CacheControl: 'max-age=31536000', // 1 year cache
      });

      await this.s3Client.send(command);

      // Return the public URL
      return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${filename}`;
    } catch (error: any) {
      console.error('Product image upload failed. Check the storage connection and credentials.');
      
      // Check if it's a token expiration error
      if (['ExpiredToken', 'InvalidToken'].includes(error?.name)) {
        console.error('AWS session credentials are invalid or expired. Update the matching credential set securely.');
        throw new Error('Storage credentials are invalid or expired. Please contact support.');
      }
      
      // Check for other credential issues
      if ((error as any).name === 'InvalidAccessKeyId' || (error as any).name === 'SignatureDoesNotMatch') {
        console.error('AWS credentials are invalid. Please check your access keys.');
        throw new Error('Invalid AWS credentials');
      }
      
      throw new Error('Failed to upload image');
    }
  }

  async deleteImage(imageUrl: string): Promise<void> {
    try {
      const url = new URL(imageUrl);
      const key = decodeURIComponent(url.pathname.substring(1));
      if (!key || key.includes('..') || key.startsWith('/') || key.includes('\\')) {
        throw new Error('Invalid cloud image key');
      }

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('Error deleting image:', error);
      // Don't throw error for delete operations
    }
  }

  async generatePresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!/^[a-zA-Z0-9/_ .-]+$/.test(key) || key.includes('..')) {
      throw new Error('Invalid cloud image key');
    }
    const boundedExpiry = Math.min(Math.max(Math.floor(expiresIn), 60), 3600);
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn: boundedExpiry });
  }
}

let cloudStorageService: CloudStorageService | null = null;

export function initializeCloudStorage(): void {
  const config = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID?.trim() || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY?.trim() || '',
    region: process.env.AWS_REGION?.trim() || 'us-east-1',
    bucketName: process.env.AWS_S3_BUCKET?.trim() || '',
    sessionToken: process.env.AWS_SESSION_TOKEN?.trim(),
    endpoint: process.env.AWS_S3_ENDPOINT?.trim(),
  };

  if (!config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
    cloudStorageService = null;
    console.log(process.env.NODE_ENV === 'production'
      ? 'Cloud storage is not configured. Production image uploads are disabled.'
      : 'Cloud storage is not configured. Local image storage is available in development only.');
    return;
  }

  try {
    cloudStorageService = new CloudStorageService(config);
    console.log('Cloud storage client configured. Connection has not yet been verified.');
  } catch (error) {
    console.warn('Failed to configure cloud storage.');
    console.log(process.env.NODE_ENV === 'production' ? 'Production image uploads are disabled.' : 'Local storage is available in development only.');
    cloudStorageService = null;
  }
}

// Function to reinitialize cloud storage with fresh credentials
export function reinitializeCloudStorage(): void {
  console.log('Reinitializing cloud storage with fresh credentials...');
  initializeCloudStorage();
}

export function getCloudStorageService(): CloudStorageService {
  if (!cloudStorageService) {
    throw new Error('Cloud storage service not initialized');
  }
  return cloudStorageService;
}

export function isCloudStorageEnabled(): boolean {
  return cloudStorageService !== null;
}