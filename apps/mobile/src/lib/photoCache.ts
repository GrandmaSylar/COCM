import { Paths, Directory, File } from 'expo-file-system';
import { getLocalDb } from './db';

const avatarDir = new Directory(Paths.document, 'avatars');

async function ensureAvatarDirectory() {
  if (!avatarDir.exists) {
    avatarDir.create();
  }
}

/**
 * WhatsApp-Style Profile Picture Caching Engine (Expo SDK 57):
 * 1. Checks local device file system (`avatars/{memberId}.jpg`).
 * 2. If present, returns local `file://...` URI immediately with 0 network calls.
 * 3. If missing, downloads from Cloudinary/CDN, writes to local disk, and returns disk URI.
 */
export async function getOrCacheProfilePhoto(memberId: string, remotePhotoUrl?: string | null): Promise<string | null> {
  if (!remotePhotoUrl) return null;

  try {
    ensureAvatarDirectory();
    
    const fileExtension = remotePhotoUrl.split('.').pop()?.split('?')[0] || 'jpg';
    const avatarFile = new File(avatarDir, `${memberId}.${fileExtension}`);

    // Read from local cache if present (WhatsApp pattern)
    if (avatarFile.exists) {
      return avatarFile.uri;
    }

    // Download from CDN once and store to phone disk
    const downloadedFile = await File.downloadFileAsync(remotePhotoUrl, avatarFile, { idempotent: true });
    if (downloadedFile && downloadedFile.exists) {
      // Save local photo path to SQLite
      const db = await getLocalDb();
      await db.runAsync('UPDATE members SET local_photo_path = ? WHERE id = ?', [downloadedFile.uri, memberId]);
      return downloadedFile.uri;
    }
  } catch (err) {
    console.warn(`[PhotoCache] Failed caching avatar for ${memberId}:`, err);
  }

  // Fallback to remote URL if download failed
  return remotePhotoUrl;
}
