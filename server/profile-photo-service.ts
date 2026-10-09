import type { User } from "../shared/schema";
import { prepareProfileImage } from "./profile-image";
import { getCloudStorageService } from "./cloudStorage";

type ProfilePhotoRepository = {
  getUser(userId: string): Promise<User | undefined>;
  updateUserProfile(userId: string, updates: { profileImageUrl: string | null }): Promise<User | undefined>;
};

export class ProfilePhotoAccountNotFoundError extends Error {}

type ProfilePhotoStorage = {
  uploadImage(image: Buffer, contentType: string, folder: string): Promise<string>;
  deleteImage(url: string): Promise<void>;
};

export async function updateProfilePhoto(
  userId: string,
  image: Buffer | null,
  repository: ProfilePhotoRepository,
  imageStorage?: ProfilePhotoStorage,
): Promise<{ user: User; previousImageUrl: string | null }> {
  const previousUser = await repository.getUser(userId);
  if (!previousUser) throw new ProfilePhotoAccountNotFoundError("Account not found.");

  let profileImageUrl: string | null = null;
  if (image !== null) {
    const prepared = await prepareProfileImage(image);
    imageStorage ??= getCloudStorageService();
    profileImageUrl = await imageStorage.uploadImage(prepared, "image/jpeg", "profiles");
  }
  try {
    const user = await repository.updateUserProfile(userId, { profileImageUrl });
    if (!user) throw new ProfilePhotoAccountNotFoundError("Account not found.");
    return { user, previousImageUrl: previousUser.profileImageUrl };
  } catch (error) {
    if (profileImageUrl && imageStorage) {
      await imageStorage.deleteImage(profileImageUrl).catch(() => {
        console.error("Unsaved profile photo cleanup could not complete.");
      });
    }
    throw error;
  }
}
