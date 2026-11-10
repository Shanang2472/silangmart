import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

type CloudinaryCredentials = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

function getCloudinaryCredentials(): CloudinaryCredentials | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() || '';
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim() || '';
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() || '';
  const configuredValues = [cloudName, apiKey, apiSecret].filter(Boolean).length;

  if (configuredValues === 0) return null;
  if (configuredValues !== 3) {
    throw new Error('Cloudinary requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
  }

  return { cloudName, apiKey, apiSecret };
}

export function validateImageStorageConfiguration(): void {
  if (process.env.NODE_ENV === 'production' && !getCloudinaryCredentials()) {
    throw new Error('Production image uploads require Cloudinary credentials.');
  }
}

export async function storeImage(
  file: Express.Multer.File,
  folder: string,
  localDirectory: string
): Promise<string> {
  if (!file.buffer?.length) throw new Error('The uploaded image is empty.');

  const credentials = getCloudinaryCredentials();
  if (credentials) {
    cloudinary.config({
      cloud_name: credentials.cloudName,
      api_key: credentials.apiKey,
      api_secret: credentials.apiSecret,
      secure: true,
    });

    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder, public_id: randomUUID(), resource_type: 'image' },
        (error, result) => {
          if (error) {
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
          } else if (!result?.secure_url) {
            reject(new Error('Cloudinary upload completed without a secure image URL.'));
          } else {
            resolve(result.secure_url);
          }
        }
      ).end(file.buffer);
    });
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cloudinary credentials are required for production image uploads.');
  }

  const extension = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.jpg';
  const filename = `${Date.now()}-${randomUUID()}${extension}`;
  const directory = path.join(process.cwd(), 'uploads', localDirectory);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, filename), file.buffer);
  return `/uploads/${encodeURIComponent(localDirectory)}/${encodeURIComponent(filename)}`;
}
