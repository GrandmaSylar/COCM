import { fetchApi } from './apiClient';

export async function uploadToCloudinary(file: File, memberId: string): Promise<string> {
  const maxAttempts = 3;
  let delay = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // 1. Request signature from edge function
      const signResponse = await fetchApi('/cloudinary/sign', { method: 'POST' });

      // 2. Build FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', signResponse.apiKey);
      formData.append('timestamp', String(signResponse.timestamp));
      formData.append('signature', signResponse.signature);
      formData.append('folder', 'member-photos');
      if (signResponse.uploadPreset) {
        formData.append('upload_preset', signResponse.uploadPreset);
      }

      // We can use cloudName directly from the response, or fallback to env var
      const cloudName = signResponse.cloudName || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

      // 3. POST to Cloudinary directly
      const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
        // Do not set Content-Type header so the browser sets the correct multipart boundary
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Cloudinary upload failed: ${uploadResponse.status} ${errorText}`);
      }

      const uploadResult = await uploadResponse.json();
      
      // 4. Extract secure_url
      if (!uploadResult.secure_url) {
        throw new Error('Cloudinary response missing secure_url');
      }

      return uploadResult.secure_url;

    } catch (error) {
      // Keep per-attempt errors internal
      if (attempt < maxAttempts) {
        // Wait before retrying (1s, 2s)
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }

  throw new Error('Photo upload failed after 3 attempts');
}
