import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class ImageProcessor {
  private cacheDir = path.join(process.cwd(), 'uploads', 'optimized');

  constructor() {
    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Optimize and cache image with specified dimensions and quality
   */
  async optimizeImage(inputPath: string, options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'jpeg' | 'webp' | 'png';
  } = {}): Promise<string> {
    const {
      width = 800,
      height = 800,
      quality = 85,
      format = 'jpeg'
    } = options;

    // Generate cache key based on input path and options
    const cacheKey = this.generateCacheKey(inputPath, options);
    const cachedPath = path.join(this.cacheDir, `${cacheKey}.${format}`);

    // Return cached version if it exists and is newer than source
    if (fs.existsSync(cachedPath)) {
      const sourceStats = fs.statSync(inputPath);
      const cacheStats = fs.statSync(cachedPath);
      
      if (cacheStats.mtime > sourceStats.mtime) {
        return cachedPath;
      }
    }

    try {
      // Optimize image with Sharp
      let transformer = sharp(inputPath)
        .resize(width, height, { 
          fit: 'inside', 
          withoutEnlargement: true 
        });

      // Apply format-specific optimizations
      switch (format) {
        case 'jpeg':
          transformer = transformer.jpeg({ 
            quality, 
            progressive: true,
            mozjpeg: true 
          });
          break;
        case 'webp':
          transformer = transformer.webp({ 
            quality,
            effort: 6 
          });
          break;
        case 'png':
          transformer = transformer.png({ 
            quality,
            compressionLevel: 8 
          });
          break;
      }

      await transformer.toFile(cachedPath);
      return cachedPath;
    } catch (error) {
      console.error(`Failed to optimize image ${inputPath}:`, error);
      return inputPath; // Return original path on error
    }
  }

  /**
   * Generate a cache key based on file path and optimization options
   */
  private generateCacheKey(inputPath: string, options: any): string {
    const basename = path.basename(inputPath, path.extname(inputPath));
    const optionsStr = JSON.stringify(options);
    const hash = crypto.createHash('md5').update(inputPath + optionsStr).digest('hex');
    return `${basename}_${hash}`;
  }

  /**
   * Clean up old cached files
   */
  async cleanupCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const files = fs.readdirSync(this.cacheDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup image cache:', error);
    }
  }

  /**
   * Get optimized image URL for serving
   */
  getOptimizedUrl(originalPath: string, options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'jpeg' | 'webp' | 'png';
  } = {}): string {
    const params = new URLSearchParams();
    
    if (options.width) params.set('w', options.width.toString());
    if (options.height) params.set('h', options.height.toString());
    if (options.quality) params.set('q', options.quality.toString());
    if (options.format) params.set('f', options.format);

    const query = params.toString();
    return `/api/images/optimize${originalPath}${query ? '?' + query : ''}`;
  }
}

export const imageProcessor = new ImageProcessor();