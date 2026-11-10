/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Delivery } from '../types';
import {
  CheckCircle,
  Camera,
  Upload,
  Coins,
  ClipboardCheck,
  AlertCircle,
  X,
  ChevronRight,
  Package,
  Phone,
  MapPin,
  User,
  Clock,
} from 'lucide-react';

interface ProofOfDeliveryModalProps {
  order: Delivery;
  riderName: string;
  onComplete: (deliveredOrder: Delivery) => void;
  onCancel: () => void;
}

type Step = 'handover' | 'photo' | 'payment' | 'review';

export default function ProofOfDeliveryModal({
  order,
  riderName,
  onComplete,
  onCancel,
}: ProofOfDeliveryModalProps) {
  const [step, setStep] = useState<Step>('handover');
  const [handoverConfirmed, setHandoverConfirmed] = useState(false);
  const [podPhoto, setPodPhoto] = useState<File | null>(null);
  const [podPreviewUrl, setPodPreviewUrl] = useState<string | null>(null);
  const [cashReceived, setCashReceived] = useState<string>(order.totalAmount.toFixed(2));
  const [cashCounted, setCashCounted] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const paymentMethod = order.paymentMethod || 'Cash';
  const isCash = paymentMethod === 'Cash';
  const isPrepaid = !isCash && order.paymentStatus === 'Paid';

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem('silang_auth_token')}`,
  });

  const steps: { key: Step; label: string }[] = [
    { key: 'handover', label: 'Handover' },
    { key: 'photo', label: 'POD Photo' },
    { key: 'payment', label: 'Payment' },
    { key: 'review', label: 'Confirm' },
  ];
  const stepIndex = steps.findIndex((s) => s.key === step);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPodPhoto(file);
    const url = URL.createObjectURL(file);
    setPodPreviewUrl(url);
  };

  const canProceedFromStep = (): boolean => {
    if (step === 'handover') return handoverConfirmed;
    if (step === 'photo') return podPhoto !== null;
    if (step === 'payment') {
      if (isPrepaid) return true;
      if (isCash) return cashCounted && parseFloat(cashReceived) >= order.totalAmount;
      return paymentRef.trim().length >= 3;
    }
    return true;
  };

  const nextStep = () => {
    setError(null);
    const order_steps: Step[] = ['handover', 'photo', 'payment', 'review'];
    const idx = order_steps.indexOf(step);
    if (idx < order_steps.length - 1) setStep(order_steps[idx + 1]);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      // 1. Upload POD photo + handover confirmation
      const formData = new FormData();
      formData.append('pod_photo', podPhoto!);
      formData.append('handoverConfirmed', 'true');
      const podRes = await fetch(`/api/deliveries/${order.id}/pod`, {
        method: 'POST',
        headers: { ...getAuthHeader() },
        body: formData,
      });
      const podData = await podRes.json();
      if (!podRes.ok || !podData.ok) throw new Error(podData.error || 'Failed to upload Proof of Delivery photo.');

      // 2. Confirm payment
      if (isCash) {
        const payRes = await fetch(`/api/deliveries/${order.id}/payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify({ paymentMethod: 'Cash', codAmountReceived: order.totalAmount, codCollectedBy: riderName, cashReceivedCounted: true }),
        });
        const payData = await payRes.json();
        if (!payRes.ok || !payData.ok) throw new Error(payData.error || 'Payment confirmation failed.');
      } else if (!isPrepaid) {
        const payRes = await fetch(`/api/deliveries/${order.id}/payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify({ paymentMethod, paymentReference: paymentRef, paymentAmount: order.totalAmount, paymentGatewayStatus: 'Successful' }),
        });
        const payData = await payRes.json();
        if (!payRes.ok || !payData.ok) throw new Error(payData.error || 'Payment confirmation failed.');
      }

      // 3. Mark as Delivered
      const statusRes = await fetch(`/api/deliveries/${order.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ deliveryStatus: 'Delivered', etaMinutes: 0 }),
      });
      const statusData = await statusRes.json();
      if (!statusRes.ok || !statusData.ok) throw new Error(statusData.error || 'Failed to update delivery status.');

      const deliveredOrder: Delivery = {
        ...order,
        status: 'Delivered',
        etaMinutes: 0,
        podPhotoUrl: podData.podPhotoUrl,
        handoverConfirmed: true,
      };
      onComplete(deliveredOrder);
    } catch (e: any) {
      setError(e?.message || 'May naganap na error. Subukan ulit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 px-5 py-4 flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-white font-black text-sm uppercase tracking-wider flex items-center gap-1.5">
              <ClipboardCheck className="h-4 w-4 text-indigo-300" />
              Proof of Delivery
            </h2>
            <p className="text-indigo-300 text-[10px] mt-0.5">Order {order.id} — {order.customerName}</p>
          </div>
          <button type="button" onClick={onCancel} className="text-indigo-300 hover:text-white transition-colors mt-0.5 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step progress bar */}
        <div className="bg-indigo-950/90 px-5 py-2.5 flex items-center gap-2 shrink-0">
          {steps.map((s, i) => (
            <React.Fragment key={s.key}>
              <div className={`flex items-center gap-1 text-[10px] font-bold transition-all ${i === stepIndex ? 'text-white' : i < stepIndex ? 'text-green-400' : 'text-indigo-500'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${i < stepIndex ? 'bg-green-500 text-white' : i === stepIndex ? 'bg-white text-indigo-700' : 'bg-indigo-800 text-indigo-400'}`}>
                  {i < stepIndex ? '✓' : i + 1}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 rounded-full ${i < stepIndex ? 'bg-green-500' : 'bg-indigo-800'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Order Info Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Order Details</p>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-black text-slate-800 text-sm flex items-center gap-1"><User className="h-3.5 w-3.5 text-indigo-500" /> {order.customerName}</p>
                <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3 text-orange-400" /> {order.address}, {order.barangay}</p>
                <p className="text-[11px] text-slate-500 flex items-center gap-1"><Phone className="h-3 w-3 text-indigo-400" /> {order.customerPhone}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[9px] text-slate-400">Total</p>
                <p className="font-black text-indigo-700 text-base">PHP {order.totalAmount.toFixed(2)}</p>
                <span className="text-[9px] font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase">{paymentMethod}</span>
              </div>
            </div>
          </div>

          {/* STEP 1: Handover */}
          {step === 'handover' && (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-black text-slate-700 mb-3 flex items-center gap-1.5"><Package className="h-4 w-4 text-indigo-500" />Kumpirmasyon ng Pagbibigay ng Order</p>
                <div className="bg-slate-50 rounded-lg p-2.5 max-h-28 overflow-y-auto space-y-1 mb-3">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-[11px]">
                      <span className="text-slate-700 truncate pr-2">{item.name}</span>
                      <span className="font-mono text-slate-500 shrink-0">x{item.quantity}</span>
                    </div>
                  ))}
                </div>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0 ${handoverConfirmed ? 'bg-green-500 border-green-500' : 'border-slate-300 group-hover:border-indigo-400'}`} onClick={() => setHandoverConfirmed((v) => !v)}>
                    {handoverConfirmed && <span className="text-white text-[10px] font-black">v</span>}
                  </div>
                  <span className="text-sm text-slate-700 leading-snug select-none" onClick={() => setHandoverConfirmed((v) => !v)}>
                    Natanggap na ng customer ang lahat ng order items. Naihatid ko na po ito ng personal.
                  </span>
                </label>
              </div>
              {!handoverConfirmed && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-[11px] text-amber-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Kailangang i-confirm ang pagbibigay ng order bago magpatuloy.</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: POD Photo */}
          {step === 'photo' && (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-black text-slate-700 mb-1 flex items-center gap-1.5"><Camera className="h-4 w-4 text-indigo-500" />Proof of Delivery Photo</p>
                <p className="text-[11px] text-slate-500 mb-4">Kumuha ng larawan ng naihatid na order kasama ang customer o pintuan ng kanilang tahanan.</p>
                {podPreviewUrl ? (
                  <div className="relative rounded-xl overflow-hidden border-2 border-green-400 aspect-video bg-slate-100">
                    <img src={podPreviewUrl} alt="POD Preview" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => { setPodPhoto(null); setPodPreviewUrl(null); }} className="absolute top-2 right-2 bg-black/60 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center transition-all cursor-pointer">
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-green-600/90 text-white text-center text-[10px] font-bold py-1.5 flex items-center justify-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Larawan ay handa na
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/50 hover:bg-indigo-50 rounded-xl py-8 flex flex-col items-center gap-2 transition-all cursor-pointer group">
                    <div className="w-12 h-12 bg-indigo-100 group-hover:bg-indigo-200 rounded-full flex items-center justify-center transition-all">
                      <Upload className="h-5 w-5 text-indigo-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-indigo-700">I-upload ang larawan</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">JPEG, PNG, o WEBP - Max 5MB</p>
                    </div>
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handlePhotoChange} capture="environment" />
                {!podPhoto && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-[11px] text-amber-700">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>Kinakailangan ang POD photo. Ito ang patunay na naihatid ang order.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Payment */}
          {step === 'payment' && (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-xl p-4 space-y-4">
                <p className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <Coins className="h-4 w-4 text-indigo-500" />
                  {isPrepaid ? `${paymentMethod} - Verified bago i-dispatch` : isCash ? 'Cash on Delivery - Koleksyon' : `${paymentMethod} - Payment Reference`}
                </p>
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-sm text-indigo-700 font-semibold">Dapat bayaran:</span>
                  <span className="text-xl font-black text-indigo-700">PHP {order.totalAmount.toFixed(2)}</span>
                </div>
                {isPrepaid ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                    <p className="font-bold">Verified payment: ₱{order.paymentAmount?.toFixed(2) ?? order.totalAmount.toFixed(2)}</p>
                    {order.paymentReference && <p className="mt-1 font-mono">Reference: {order.paymentReference}</p>}
                  </div>
                ) : isCash ? (
                  <>
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1.5">Halaga ng Cash na Natanggap (PHP)</label>
                      <input type="number" step="0.01" min={order.totalAmount} value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" placeholder={order.totalAmount.toFixed(2)} />
                      {parseFloat(cashReceived) < order.totalAmount && (
                        <p className="text-[11px] text-red-500 mt-1">Kulang ang bayad! Kailangang PHP {order.totalAmount.toFixed(2)} ang minimum.</p>
                      )}
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0 ${cashCounted ? 'bg-green-500 border-green-500' : 'border-slate-300 group-hover:border-indigo-400'}`} onClick={() => setCashCounted((v) => !v)}>
                        {cashCounted && <span className="text-white text-[10px] font-black">v</span>}
                      </div>
                      <span className="text-sm text-slate-700 leading-snug select-none" onClick={() => setCashCounted((v) => !v)}>
                        Binilang ko ang pera sa harap ng customer at tama ang halaga.
                      </span>
                    </label>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1.5">{paymentMethod} Reference Number</label>
                      <input type="text" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" placeholder="e.g. GCX-123456789" />
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[11px] text-blue-700 flex items-start gap-2">
                      <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>Ang {paymentMethod} payment ay ibe-verify ng Admin. Ilagay ang reference number mula sa {paymentMethod} notification.</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Review */}
          {step === 'review' && (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2.5">
                <p className="text-xs font-black text-green-700 uppercase tracking-wider">Review ng Delivery</p>
                <div className="space-y-1.5 text-[11px] text-slate-700">
                  <div className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" /><span>Handover confirmed - order na naibigay</span></div>
                  <div className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" /><span>POD photo uploaded - larawan ay handa</span></div>
                  <div className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" /><span>{isCash ? `Cash collected - PHP ${parseFloat(cashReceived).toFixed(2)} natanggap` : `${paymentMethod} reference: ${paymentRef}`}</span></div>
                </div>
                {podPreviewUrl && (
                  <div className="rounded-lg overflow-hidden border border-green-300 aspect-video mt-2">
                    <img src={podPreviewUrl} alt="POD" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-[11px] text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/80 shrink-0 flex gap-3">
          {stepIndex > 0 && !isSubmitting && (
            <button type="button" onClick={() => { const s: Step[] = ['handover','photo','payment','review']; setStep(s[stepIndex - 1]); setError(null); }} className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer">
              Bumalik
            </button>
          )}
          {step !== 'review' ? (
            <button type="button" onClick={nextStep} disabled={!canProceedFromStep()} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all flex items-center justify-center gap-1.5 ${canProceedFromStep() ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-95 shadow-sm' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
              Susunod <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={isSubmitting} className={`flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${isSubmitting ? 'bg-green-400 text-white cursor-wait' : 'bg-green-600 hover:bg-green-700 text-white cursor-pointer active:scale-95 shadow-md'}`}>
              {isSubmitting ? (<><span className="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4 inline-block" />Nagko-confirm...</>) : (<><CheckCircle className="h-4 w-4" />Confirm & Complete Delivery</>)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
