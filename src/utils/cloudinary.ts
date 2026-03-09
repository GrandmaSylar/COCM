export type CloudinaryVariant = 'thumbnail' | 'avatar' | 'original';

export function getCloudinaryUrl(photoUrl: string | null | undefined, variant: CloudinaryVariant): string | null {
  if (!photoUrl) return null;
  if (!photoUrl.includes('res.cloudinary.com')) return photoUrl;
  if (variant === 'original') return photoUrl;

  const uploadIndex = photoUrl.indexOf('/upload/');
  if (uploadIndex === -1) return photoUrl;

  const beforeUpload = photoUrl.slice(0, uploadIndex);
  const afterUpload = photoUrl.slice(uploadIndex + '/upload/'.length);

  const transformation =
    variant === 'thumbnail'
      ? 'w_56,h_56,c_fill,g_center'
      : 'w_160,h_160,c_fill,g_center';

  return `${beforeUpload}/upload/${transformation}/${afterUpload}`;
}
