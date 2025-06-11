import { getCloudStorageService, isCloudStorageEnabled } from "./cloudStorage";
import { storage } from "./storage";

export class ImageOptimizer {
  /**
   * Migrate existing local images to cloud storage
   */
  async migrateLocalImagesToCloud(): Promise<void> {
    if (!isCloudStorageEnabled()) {
      console.log('Cloud storage not enabled, skipping migration');
      return;
    }

    try {
      const products = await storage.getProducts();
      const cloudStorage = getCloudStorageService();
      
      for (const product of products) {
        let hasChanges = false;
        const updatedImages: string[] = [];

        // Process images array
        if (product.images && Array.isArray(product.images)) {
          for (const imagePath of product.images) {
            if (typeof imagePath === 'string' && imagePath.startsWith('/uploads/')) {
              try {
                // Read local file
                const fs = await import('fs');
                const path = await import('path');
                // Extract filename from the path and construct correct file path
                const filename = path.basename(imagePath);
                const localPath = path.join(process.cwd(), 'uploads', 'products', filename);
                
                console.log(`Checking file: ${localPath}`);
                if (fs.existsSync(localPath)) {
                  const imageBuffer = fs.readFileSync(localPath);
                  const cloudUrl = await cloudStorage.uploadImage(imageBuffer, 'image/jpeg', 'products');
                  updatedImages.push(cloudUrl);
                  hasChanges = true;
                  console.log(`Migrated image: ${imagePath} -> ${cloudUrl}`);
                } else {
                  console.log(`File not found: ${localPath}`);
                  // Keep the original if file doesn't exist
                  updatedImages.push(imagePath);
                }
              } catch (error) {
                console.error(`Failed to migrate image ${imagePath}:`, error);
                updatedImages.push(imagePath);
              }
            } else {
              // Keep non-local images as-is
              updatedImages.push(imagePath);
            }
          }
        }

        // Update database if changes were made
        if (hasChanges) {
          await this.updateProductImages(product.id, updatedImages);
          console.log(`Updated product ${product.id} with cloud image URLs`);
        }
      }

      console.log('Image migration to cloud storage completed');
    } catch (error) {
      console.error('Error during image migration:', error);
    }
  }

  /**
   * Update product images in database
   */
  private async updateProductImages(productId: number, imageUrls: string[]): Promise<void> {
    const { db } = await import('./db');
    const { eq } = await import('drizzle-orm');
    const { products } = await import('@shared/schema');

    await db
      .update(products)
      .set({ images: imageUrls })
      .where(eq(products.id, productId));
  }

  /**
   * Clean up old local files after successful migration
   */
  async cleanupLocalFiles(): Promise<void> {
    if (!isCloudStorageEnabled()) {
      return;
    }

    try {
      const products = await storage.getProducts();
      const fs = await import('fs');
      const path = await import('path');
      
      for (const product of products) {
        if (product.images && Array.isArray(product.images)) {
          for (const imagePath of product.images) {
            if (typeof imagePath === 'string' && imagePath.startsWith('/uploads/')) {
              const localPath = path.join(process.cwd(), imagePath);
              if (fs.existsSync(localPath)) {
                try {
                  fs.unlinkSync(localPath);
                  console.log(`Cleaned up local file: ${localPath}`);
                } catch (error) {
                  console.error(`Failed to delete local file ${localPath}:`, error);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Get optimized image URL (handles both cloud and local)
   */
  static getOptimizedImageUrl(imagePath: string, baseUrl?: string): string {
    if (!imagePath) return '';
    
    // If it's already a full URL (cloud storage), return as-is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    // If it's a local path, construct the full URL
    if (imagePath.startsWith('/uploads/')) {
      return baseUrl ? `${baseUrl}${imagePath}` : imagePath;
    }
    
    return imagePath;
  }
}

export const imageOptimizer = new ImageOptimizer();