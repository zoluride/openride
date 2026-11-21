import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export interface DocumentFile {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  base64?: string;
  width?: number;
  height?: number;
}

export async function pickDocumentFile(): Promise<DocumentFile | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return null;
    }

    const file = result.assets?.[0];
    if (!file) {
      return null;
    }

    return {
      uri: file.uri,
      name: file.name,
      mimeType: file.mimeType || 'application/octet-stream',
      size: file.size,
    };
  } catch (error) {
    throw new Error(`Failed to pick document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function pickImageFile(): Promise<DocumentFile | null> {
  try {
    // Request camera roll permissions
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Camera roll permission required');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.9,
      exif: false,
    });

    if (result.canceled) {
      return null;
    }

    const asset = result.assets?.[0];
    if (!asset) {
      return null;
    }

    return {
      uri: asset.uri,
      name: `photo_${Date.now()}.jpg`,
      mimeType: 'image/jpeg',
      width: asset.width,
      height: asset.height,
    };
  } catch (error) {
    throw new Error(`Failed to pick image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function takeCameraPhoto(): Promise<DocumentFile | null> {
  try {
    // Request camera permissions
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Camera permission required');
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.9,
      exif: false,
    });

    if (result.canceled) {
      return null;
    }

    const asset = result.assets?.[0];
    if (!asset) {
      return null;
    }

    return {
      uri: asset.uri,
      name: `photo_${Date.now()}.jpg`,
      mimeType: 'image/jpeg',
      width: asset.width,
      height: asset.height,
    };
  } catch (error) {
    throw new Error(`Failed to take photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload a file to Supabase Storage
 * @param supabaseClient The Supabase client instance
 * @param bucket The storage bucket name
 * @param file The file to upload
 * @param driverId The driver ID (used in path)
 * @param docType The document type (used in path)
 * @returns The storage path
 */
export async function uploadFileToStorage(
  supabaseClient: unknown,
  bucket: string,
  file: DocumentFile,
  driverId: string,
  docType: string,
): Promise<string> {
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${driverId}/${docType}/${timestamp}_${sanitizedName}`;

  // Read file as blob for upload
  let blob: Blob;
  if (Platform.OS === 'web') {
    // On web, fetch the file
    const response = await fetch(file.uri);
    blob = await response.blob();
  } else {
    // On native, we need to fetch and convert
    const response = await fetch(file.uri);
    blob = await response.blob();
  }

  const typedClient = supabaseClient as { storage: { from: (name: string) => unknown } };
  const storageRef = typedClient.storage.from(bucket) as {
    upload: (path: string, file: Blob, options: unknown) => Promise<{ error?: { message: string } }>;
  };
  const { error } = await storageRef.upload(storagePath, blob, {
    contentType: file.mimeType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return storagePath;
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFileFromStorage(
  supabaseClient: unknown,
  bucket: string,
  storagePath: string,
): Promise<void> {
  const typedClient = supabaseClient as { storage: { from: (name: string) => unknown } };
  const storageRef = typedClient.storage.from(bucket) as {
    remove: (paths: string[]) => Promise<{ error?: { message: string } }>;
  };
  const { error } = await storageRef.remove([storagePath]);

  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}
