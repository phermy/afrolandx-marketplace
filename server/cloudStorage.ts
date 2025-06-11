import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import crypto from 'crypto';

interface CloudStorageConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucketName: string;
  endpoint?: string;
}

class CloudStorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(config: CloudStorageConfig) {
    this.s3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      endpoint: config.endpoint,
      forcePathStyle: true, // Required for some S3-compatible services
    });
    this.bucketName = config.bucketName;
  }

  async uploadImage(buffer: Buffer, contentType: string, folder: string = 'products'): Promise<string> {
    try {
      // Optimize image with sharp
      const optimizedBuffer = await sharp(buffer)
        .resize(800, 800, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .jpeg({ 
          quality: 85,
          progressive: true 
        })
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
      return `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${filename}`;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
    }
  }

  async deleteImage(imageUrl: string): Promise<void> {
    try {
      // Extract key from URL
      const url = new URL(imageUrl);
      const key = url.pathname.substring(1); // Remove leading slash

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
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }
}

let cloudStorageService: CloudStorageService | null = null;

export function initializeCloudStorage(): void {
  const config = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
    bucketName: process.env.AWS_S3_BUCKET || '',
    endpoint: process.env.AWS_S3_ENDPOINT,
  };

  if (!config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
    console.log('Cloud storage credentials not provided. Using local storage fallback.');
    return;
  }

  try {
    cloudStorageService = new CloudStorageService(config);
    console.log('Cloud storage service initialized successfully');
  } catch (error) {
    console.warn('Failed to initialize cloud storage:', error);
    console.log('Falling back to local storage');
    cloudStorageService = null;
  }
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