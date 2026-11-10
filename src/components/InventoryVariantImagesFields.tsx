/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { VariantType } from '../types/upload';

export type VariantImagesState = Partial<Record<VariantType, File | null>>;

type Props = {
  variantImages: VariantImagesState;
  setVariantImages: (next: VariantImagesState) => void;
  onClearVariantImages?: () => void;
  existingVariantImages?: Partial<Record<VariantType, string>>;
  onRemoveExistingImage?: (type: VariantType) => void;
};

function setFileFor(type: VariantType, file: File | null, variantImages: VariantImagesState, setVariantImages: Props['setVariantImages']) {
  setVariantImages({
    ...variantImages,
    [type]: file,
  });
}

export default function InventoryVariantImagesFields({
  variantImages,
  setVariantImages,
  onClearVariantImages,
  existingVariantImages,
  onRemoveExistingImage,
}: Props) {
  const types: { type: VariantType; label: string }[] = [
    { type: 'retail', label: 'Retail / Tingi' },
    { type: 'package', label: 'Package / Balot' },
    { type: 'box', label: 'Box / Karton' },
    { type: 'wholesale', label: 'Wholesale / Pakyaw' },
    { type: 'sack', label: 'Sako / Sack' },
  ];

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-slate-400 leading-relaxed">
        Opsyonal ang variant images. Kung walang laman, gagamit ng product emoji fallback.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {types.map(({ type, label }) => {
          const file = variantImages[type] || null;
          const previewUrl = file ? URL.createObjectURL(file) : null;
          const existingUrl = existingVariantImages?.[type];

          return (
            <div key={type} className="space-y-2 p-2.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">{label} Image</label>
                {existingUrl && !file && (
                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    Naka-save
                  </span>
                )}
              </div>

              {/* Show existing saved image if no new file is chosen yet */}
              {existingUrl && !file && (
                <div className="flex items-center gap-2.5 p-2 bg-emerald-50/50 rounded-lg border border-emerald-100">
                  <img
                    src={existingUrl}
                    alt={`${label} saved`}
                    className="w-11 h-11 object-cover rounded-md border border-emerald-200 bg-white shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-slate-700 text-[11px] block truncate">Kasalukuyang Larawan</span>
                    <span className="text-[9px] text-slate-400 block truncate">{existingUrl.split('/').pop()}</span>
                    {onRemoveExistingImage && (
                      <button
                        type="button"
                        onClick={() => onRemoveExistingImage(type)}
                        className="text-red-500 font-bold text-[9px] hover:underline mt-0.5 cursor-pointer block"
                      >
                        Tanggalin ang larawan
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* File upload input */}
              <div>
                {existingUrl && !file && (
                  <span className="text-[9px] text-slate-400 block mb-1">Palitan ng bagong litrato:</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setFileFor(type, f, variantImages, setVariantImages);
                  }}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>

              {/* Preview of newly selected file */}
              {previewUrl && (
                <div className="flex items-center gap-2.5 p-2 bg-blue-50/60 rounded-lg border border-blue-200">
                  <img
                    src={previewUrl}
                    alt={`${label} new preview`}
                    className="w-11 h-11 object-cover rounded-md border border-blue-300 bg-white shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-blue-900 text-[11px] block truncate">{file?.name || 'Bagong napiling file'}</span>
                    <span className="text-[9px] text-blue-600 block">Bagong ia-upload</span>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          URL.revokeObjectURL(previewUrl);
                        } catch {
                          // ignore
                        }
                        setFileFor(type, null, variantImages, setVariantImages);
                      }}
                      className="text-red-500 font-bold text-[9px] hover:underline mt-0.5 cursor-pointer block"
                    >
                      Kanselahin ang bago
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {onClearVariantImages && (
        <div className="pt-1">
          <button
            type="button"
            onClick={onClearVariantImages}
            className="text-[10px] text-slate-500 font-bold hover:text-slate-700 hover:underline cursor-pointer"
          >
            I-clear lahat ng variant images
          </button>
        </div>
      )}
    </div>
  );
}
