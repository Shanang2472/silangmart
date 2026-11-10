export type VariantType = 'retail' | 'package' | 'box' | 'wholesale' | 'sack';

export type VariantImagePayload = Partial<Record<VariantType, string>>;
