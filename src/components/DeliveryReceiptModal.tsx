/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Delivery } from '../types';
import { X, Printer, Download, CheckCircle } from 'lucide-react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';

interface DeliveryReceiptModalProps {
  delivery: Delivery;
  onClose: () => void;
}

export default function DeliveryReceiptModal({ delivery, onClose }: DeliveryReceiptModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    const qrData = [
      'SILANG MINI MART',
      'Delivery Receipt',
      `Delivery ID: ${delivery.id}`,
      `Branch: ${delivery.branch}`,
      `Customer: ${delivery.customerName}`,
      `Phone: ${delivery.customerPhone}`,
      `Address: ${delivery.address}`,
      `Items: ${delivery.items.length}`,
      `VAT included: PHP ${vatAmount.toFixed(2)}`,
      `Total: PHP ${delivery.totalAmount.toFixed(2)}`,
      `Payment: ${delivery.paymentMethod || 'Cash'}`,
      `Date: ${new Date(delivery.timestamp).toLocaleString('en-PH')}`,
      'Delivered. Maraming Salamat po!',
    ].join('\n');

    QRCode.toDataURL(qrData, { margin: 1, width: 250 })
      .then((url) => setQrCodeUrl(url))
      .catch((err) => console.error('Failed to generate QR Code:', err));
  }, [delivery]);

  const subtotal = delivery.items.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const vatAmount = Math.round(subtotal * 12 / 112 * 100) / 100;
  const deliveryFee = delivery.deliveryFee || 0;
  const dateStr = new Date(delivery.timestamp).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
    let y = 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('SILANG MINI MART', 40, y, { align: 'center' });
    y += 5;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Delivery Official Receipt', 40, y, { align: 'center' });
    y += 4;
    doc.text(`Branch: ${delivery.branch}`, 40, y, { align: 'center' });
    y += 6;

    doc.setFontSize(7);
    doc.text(`Delivery ID: ${delivery.id}`, 5, y);
    y += 4;
    doc.text(`Date: ${dateStr}`, 5, y);
    y += 4;
    doc.text(`Customer: ${delivery.customerName}`, 5, y);
    y += 4;
    doc.text(`Phone: ${delivery.customerPhone}`, 5, y);
    y += 4;
    doc.text(`Address: ${delivery.address}`, 5, y);
    y += 4;
    doc.text(`Barangay: ${delivery.barangay}`, 5, y);
    y += 4;
    doc.text(`Rider: ${delivery.driverName}`, 5, y);
    y += 4;
    doc.text(`Payment: ${delivery.paymentMethod || 'Cash'}`, 5, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('ITEMS:', 5, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    delivery.items.forEach((item) => {
      const line = `${item.name} x${item.quantity} = PHP ${(item.price * item.quantity).toFixed(2)}`;
      doc.text(line, 5, y);
      y += 4;
    });

    y += 2;
    doc.line(5, y, 75, y);
    y += 4;
    doc.text(`Subtotal: PHP ${subtotal.toFixed(2)}`, 5, y);
    y += 4;
    doc.text(`VAT included (12%): PHP ${vatAmount.toFixed(2)}`, 5, y);
    y += 4;
    doc.text(`Delivery Fee: PHP ${deliveryFee.toFixed(2)}`, 5, y);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: PHP ${delivery.totalAmount.toFixed(2)}`, 5, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text('Maraming Salamat po!', 40, y, { align: 'center' });
    y += 4;
    doc.text('SILANG MINI MART', 40, y, { align: 'center' });

    doc.save(`Delivery-Receipt-${delivery.id}.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[300] animate-fade-in">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-green-50 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="font-black text-green-800 text-sm uppercase tracking-wide">Delivery Receipt</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Printable area */}
        <div className="flex-1 overflow-y-auto p-5 font-mono text-xs text-slate-800 space-y-4">
          {/* Branding */}
          <div className="text-center space-y-0.5">
            <div className="text-xl">🌅</div>
            <h2 className="text-sm font-black tracking-tight text-blue-800 uppercase">SILANG MINI MART</h2>
            <p className="text-[9px] font-bold text-green-600 uppercase tracking-widest">Convenience Store</p>
            <p className="text-[9px] text-slate-400">{delivery.branch} Branch</p>
            <p className="text-[9px] text-slate-400">Official Delivery Receipt</p>
          </div>

          {/* Delivery metadata */}
          <div className="border-y border-dashed border-slate-200 py-2 text-left text-[10px] space-y-0.5 text-slate-500">
            <div className="flex justify-between">
              <span>DELIVERY ID:</span>
              <span className="font-bold text-slate-700">{delivery.id}</span>
            </div>
            <div className="flex justify-between">
              <span>PETSA:</span>
              <span>{dateStr}</span>
            </div>
            <div className="flex justify-between">
              <span>CUSTOMER:</span>
              <span className="font-bold text-slate-700">{delivery.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span>PHONE:</span>
              <span>{delivery.customerPhone}</span>
            </div>
            <div className="flex justify-between">
              <span>ADDRESS:</span>
              <span className="text-right max-w-[55%]">{delivery.address}</span>
            </div>
            <div className="flex justify-between">
              <span>BARANGAY:</span>
              <span>{delivery.barangay}</span>
            </div>
            <div className="flex justify-between">
              <span>RIDER:</span>
              <span className="font-bold text-slate-700 text-right max-w-[55%]">{delivery.driverName}</span>
            </div>
            <div className="flex justify-between">
              <span>BAYAD:</span>
              <span className="font-bold text-slate-700">{delivery.paymentMethod || 'Cash'}</span>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-1.5 text-left text-[11px]">
            <div className="grid grid-cols-12 gap-1 font-bold text-slate-600 border-b border-dashed border-slate-200 pb-1">
              <span className="col-span-6">PRODUKTO</span>
              <span className="col-span-2 text-center">QTY</span>
              <span className="col-span-4 text-right">HALAGA</span>
            </div>
            {delivery.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-1 text-slate-700">
                <span className="col-span-6 truncate leading-tight">{item.name}</span>
                <span className="col-span-2 text-center">{item.quantity}</span>
                <span className="col-span-4 text-right">₱{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-dashed border-slate-200 pt-2 space-y-1 text-[11px] text-slate-700">
            <div className="flex justify-between">
              <span>SUBTOTAL:</span>
              <span>₱{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>VAT 12% (kasama sa presyo ng produkto):</span>
              <span>₱{vatAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>DELIVERY FEE:</span>
              <span className={deliveryFee === 0 ? 'text-green-600 font-bold' : ''}>
                {deliveryFee === 0 ? 'FREE' : `₱${deliveryFee.toFixed(2)}`}
              </span>
            </div>
            <div className="flex justify-between font-extrabold text-sm border-t border-dashed border-slate-200 pt-1 text-slate-900">
              <span>KABUUAN:</span>
              <span>₱{delivery.totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-green-700 font-bold mt-1">
              <span>STATUS:</span>
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                NAIHATID NA / DELIVERED
              </span>
            </div>
          </div>

          {/* QR Code */}
          {qrCodeUrl && (
            <div className="border-t border-dashed border-slate-200 pt-3 flex flex-col items-center gap-1 select-none">
              <div className="bg-white p-1.5 border border-slate-200 rounded-xl shadow-xs">
                <img src={qrCodeUrl} alt="Delivery Receipt QR Code" className="w-24 h-24" />
              </div>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                Delivery Receipt QR — Scan to Verify
              </span>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-dashed border-slate-200 pt-3 text-center space-y-1 text-[10px] text-slate-400">
            <p className="font-bold text-slate-500">Maraming Salamat po sa inyong pagtangkilik!</p>
            <p>Mabuhay! 🌅</p>
            <p className="font-sans text-[8px] tracking-widest mt-1">S-I-L-A-N-G · M-I-N-I · M-A-R-T</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-auto pt-3 px-5 pb-5 border-t border-slate-100 space-y-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="w-full py-2.5 text-xs font-bold rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <Download className="h-4 w-4" />
            <span>I-download ang PDF Resibo</span>
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="py-2 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-1.5 cursor-pointer text-slate-600"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>I-print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2 text-xs font-bold rounded-xl bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Tapos Na</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
