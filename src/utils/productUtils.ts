import { Product, PackagingVariant } from '../types';

function isDisplayableImage(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const image = value.trim();
  if (!image || image.length < 8) return false;

  const validPrefixes = ['http://', 'https://', '/uploads/', 'data:image/', 'blob:'];
  const hasValidPrefix = validPrefixes.some((prefix) => image.startsWith(prefix));

  if (!hasValidPrefix) return false;

  if (image.startsWith('data:image/')) {
    return image.includes(';base64,') && image.length > 32;
  }

  return true;
}

function sanitizeImages(images: unknown): string[] {
  if (!Array.isArray(images)) return [];

  return images
    .map((img) => (typeof img === 'string' ? img.trim() : ''))
    .filter((img) => isDisplayableImage(img));
}

/**
 * Gets the list of images for a product. If the product does not have any,
 * it returns a custom list of high-quality emojis relevant to its category.
 */
export function getProductImages(product: Product): string[] {
  const sanitized = sanitizeImages(product.images);
  if (sanitized.length > 0) {
    return sanitized;
  }

  // High-quality contextual emojis representing different angles/packaging variants
  const categoryEmojis: Record<string, string[]> = {
    'Rice & Grains': ['🌾', '🛍️', '📦', '🍚'],
    'Canned Goods': ['🥫', '📦', '💝', '🍽️'],
    'Noodles & Instant': ['🍜', '📦', '🥢', '🍲'],
    'Milk & Dairy': ['🥛', '🧀', '📦', '🍼'],
    'Bread & Bakery': ['🍞', '🥐', '🥯', '🍰'],
    'Beverages': ['🥤', '🍹', '📦', '🍾'],
    'Snacks': ['🍿', '🍪', '🍫', '📦'],
    'Toiletries': ['🧼', '🧻', '🧴', '🚿'],
    'Household': ['🧹', '🧼', '🧺', '📦']
  };

  return categoryEmojis[product.category] || ['🛒', '📦', '🛍️', '✨'];
}

/**
 * Retrieves saved packaging variants, falling back to the product's retail price.
 */
export function getProductVariants(product: Product): PackagingVariant[] {
  if (product.variants && product.variants.length > 0) {
    return product.variants
      .map((variant) => ({
        ...variant,
        image: isDisplayableImage(variant.image) ? variant.image : undefined,
      }))
      .filter((variant) => variant.type || variant.label || variant.price !== undefined);
  }

  const baseUnit = product.unit;
  const images = getProductImages(product);

  return [
    {
      type: 'retail',
      label: `Daily Retail (1 ${baseUnit})`,
      qtyPerUnit: 1,
      price: product.price,
      cost: product.cost,
      unitName: baseUnit,
      image: images[0] || '🌾'
    }
  ];
}

export function getProductExpiryStatus(expiryDate?: string): 'expired' | 'expiring' | 'fresh' | 'unknown' {
  if (!expiryDate) return 'unknown';
  const expiry = new Date(`${expiryDate.slice(0, 10)}T23:59:59`);
  if (!Number.isFinite(expiry.getTime())) return 'unknown';
  const daysRemaining = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= 30) return 'expiring';
  return 'fresh';
}
