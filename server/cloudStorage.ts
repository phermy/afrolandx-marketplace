// Keep existing callers on one storage interface while using Cloudflare R2
// exclusively. No AWS credentials or AWS service requests are used here.
export {
  CloudStorageService,
  initializeCloudStorage,
  reinitializeCloudStorage,
  getCloudStorageService,
  isCloudStorageEnabled,
} from "./r2-storage";
