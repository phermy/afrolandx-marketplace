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

export function normalizeCloudStorageRegion(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (/^[a-z]{2,8}(?:-[a-z0-9]+)+-\d+$/.test(normalized)) return normalized;
  // AWS console region labels can include a human-readable name with the code.
  // Accept exactly one explicit code; never infer a region from an ARN or URL.
  if (/^[a-z0-9\s(),-]+$/.test(normalized)) {
    const codes = normalized.match(/\b[a-z]{2,8}(?:-[a-z0-9]+)+-\d+\b/g);
    if (codes?.length === 1) return codes[0];
  }
  return value.trim();
}

export function cloudStorageConfigProblem(config: Pick<CloudStorageConfig, "region" | "bucketName" | "endpoint">): string | null {
  const region = normalizeCloudStorageRegion(config.region);
  if (!/^[a-z]{2,8}(?:-[a-z0-9]+)+-\d+$/.test(region) && !(config.endpoint && region === "auto")) {
    return "Enter an AWS region code such as af-south-1, not an ARN, account ID or URL.";
  }
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(config.bucketName)
    || config.bucketName.includes("..") || /^\d+\.\d+\.\d+\.\d+$/.test(config.bucketName)) {
    return "Enter only the S3 bucket name, not an ARN or URL.";
  }
  if (config.endpoint) {
    try {
      const endpoint = new URL(config.endpoint);
      if (!["https:", "http:"].includes(endpoint.protocol) || endpoint.username || endpoint.password) {
        return "The custom storage endpoint is invalid.";
      }
    } catch {
      return "The custom storage endpoint is invalid.";
    }
  }
  return null;
}

export class CloudStorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;

  constructor(config: CloudStorageConfig & { sessionToken?: string }) {
    // Validate before constructing the SDK, which may log malformed endpoint
    // values itself. Error messages must never include supplied configuration.
    const problem = cloudStorageConfigProblem(config);
    if (problem) throw new Error(problem);
    const region = normalizeCloudStorageRegion(config.region);
    const credentials: any = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    };

    // AKIA keys are long-lived IAM credentials. An old STS token must not be
    // attached to them; temporary credentials still require their matching token.
    if (config.sessionToken && !config.accessKeyId.startsWith("AKIA")) {
      credentials.sessionToken = config.sessionToken;
    }

    this.s3Client = new S3Client({
      region,
      credentials,
      endpoint: config.endpoint,
      forcePathStyle: true, // Required for some S3-compatible services
    });
    this.bucketName = config.bucketName;
    this.region = region;
  }

  async checkConnection(): Promise<{ connectionReady: boolean; status: string }> {
    try {
      // Read-only check. This does not claim that uploads or public reads passed.
      await this.s3Client.send(new ListObjectsV2Command({ Bucket: this.bucketName, MaxKeys: 0 }));
      return { connectionReady: true, status: "Storage connection verified. Upload and image delivery still need testing." };
    } catch (error: any) {
      if (error?.name === "NoSuchBucket") {
        return { connectionReady: false, status: "The configured storage bucket was not found. Check its exact name and AWS region." };
      }
      if (error?.name === "AccessDenied") {
        return { connectionReady: false, status: "AWS denied the bucket access check. Verify this access key's S3 bucket permissions." };
      }
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
      if (error?.name === "AccessDenied") {
        throw new Error('Storage upload permission was denied. Please contact support.');
      }
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
let cloudStorageConfigurationProblem: string | null = null;

export function initializeCloudStorage(): void {
  cloudStorageConfigurationProblem = null;
  const config = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID?.trim() || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY?.trim() || '',
    region: normalizeCloudStorageRegion(process.env.AWS_REGION?.trim() || 'us-east-1'),
    bucketName: process.env.AWS_S3_BUCKET?.trim() || '',
    sessionToken: process.env.AWS_SESSION_TOKEN?.trim(),
    endpoint: process.env.AWS_S3_ENDPOINT?.trim(),
  };

  if (!config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
    cloudStorageService = null;
    cloudStorageConfigurationProblem = "Storage is not configured.";
    console.log(process.env.NODE_ENV === 'production'
      ? 'Cloud storage is not configured. Production image uploads are disabled.'
      : 'Cloud storage is not configured. Local image storage is available in development only.');
    return;
  }

  cloudStorageConfigurationProblem = cloudStorageConfigProblem(config);
  if (cloudStorageConfigurationProblem) {
    cloudStorageService = null;
    console.warn("Cloud storage settings are invalid. Check the bucket name and AWS region.");
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

export async function getCloudStorageConnectionStatus() {
  return cloudStorageService ? cloudStorageService.checkConnection()
    : { connectionReady: false, status: cloudStorageConfigurationProblem || "Storage is not configured." };
}