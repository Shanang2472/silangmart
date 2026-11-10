/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Branch, ServiceTransaction } from '../types';
import { Smartphone, Receipt, Send, CheckCircle, Search, Printer } from 'lucide-react';

interface ValueAddedServicesProps {
  currentBranch: Branch;
  onBranchChange: (branch: Branch) => void;
  serviceTransactions: ServiceTransaction[];
  onAddServiceTransaction: (txn: ServiceTransaction) => void;
}

export default function ValueAddedServices({
  currentBranch,
  onBranchChange,
  serviceTransactions,
  onAddServiceTransaction,
}: ValueAddedServicesProps) {
  const [activeTab, setActiveTab] = useState<'load' | 'bills' | 'remit' | 'history'>('load');
  const [showReceipt, setShowReceipt] = useState<ServiceTransaction | null>(null);

  // E-Load form state
  const [loadPhone, setLoadPhone] = useState('');
  const [loadNetwork, setLoadNetwork] = useState('Smart');
  const [loadPromo, setLoadPromo] = useState('50');
  const [loadFee, setLoadFee] = useState('5');

  // Bills payment form state
  const [billProvider, setBillProvider] = useState('Meralco');
  const [billAccount, setBillAccount] = useState('');
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billFee, setBillFee] = useState('15');

  // Remittance form state
  const [remitProvider, setRemitProvider] = useState('Palawan Express');
  const [remitRecipient, setRemitRecipient] = useState('');
  const [remitSender, setRemitSender] = useState('');
  const [remitAmount, setRemitAmount] = useState('');
  const [remitFee, setRemitFee] = useState('50');

  // Load Promos lookup
  const loadPromosByNetwork: Record<string, { label: string; value: string }[]> = {
    Smart: [
      { label: 'Smart Regular 20', value: '20' },
      { label: 'Smart Regular 50', value: '50' },
      { label: 'Smart Regular 100', value: '100' },
      { label: 'Giga Video 99 (2GB + Giga Video daily)', value: '99' },
      { label: 'PowerAll 149 (12GB + Unli AllNet)', value: '149' },
    ],
    Globe: [
      { label: 'Globe Regular 20', value: '20' },
      { label: 'Globe Regular 50', value: '50' },
      { label: 'Globe Regular 100', value: '100' },
      { label: 'Go50 (5GB Data for 3 Days)', value: '50' },
      { label: 'Go90 (8GB Data for 7 Days)', value: '90' },
      { label: 'Go+99 (8GB + 8GB choice app)', value: '99' },
    ],
    TNT: [
      { label: 'TNT Regular 15', value: '15' },
      { label: 'TNT Regular 30', value: '30' },
      { label: 'SurfSaya 30 (unli call/text + 300MB)', value: '30' },
      { label: 'SurfSaya 99 (unli call/text + 2GB)', value: '99' },
    ],
    DITO: [
      { label: 'DITO Level-Up 99 (7GB + Unli DITO-to-DITO)', value: '99' },
      { label: 'DITO Level-Up 199 (16GB + Unli DITO)', value: '199' },
    ],
  };

  // Submit Load
  const handleLoadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loadPhone || loadPhone.length < 10) {
      alert('Maglagay ng tamang 11-digit phone number (E.g. 09171234567).');
      return;
    }

    const amt = parseFloat(loadPromo);
    const fee = parseFloat(loadFee) || 0;
    const total = amt + fee;

    const newSrv: ServiceTransaction = {
      id: `SRV-${Date.now().toString().slice(-4)}`,
      branch: currentBranch,
      type: 'E-Load',
      provider: `${loadNetwork} E-Load`,
      recipient: loadPhone,
      senderOrAccountName: 'Walk-in Customer',
      amount: amt,
      serviceFee: fee,
      totalAmount: total,
      status: 'Completed',
      timestamp: new Date().toISOString(),
    };

    onAddServiceTransaction(newSrv);
    setShowReceipt(newSrv);

    // Reset Form
    setLoadPhone('');
  };

  // Submit Bill
  const handleBillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!billAccount || !billName || !billAmount) {
      alert('Mangyaring punan ang account number, pangalan, at halaga ng bill.');
      return;
    }

    const amt = parseFloat(billAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Maglagay ng tamang halaga ng bill.');
      return;
    }

    const fee = parseFloat(billFee) || 0;
    const total = amt + fee;

    const newSrv: ServiceTransaction = {
      id: `SRV-${Date.now().toString().slice(-4)}`,
      branch: currentBranch,
      type: 'Bills Payment',
      provider: billProvider,
      recipient: `Account: ${billAccount}`,
      senderOrAccountName: billName,
      amount: amt,
      serviceFee: fee,
      totalAmount: total,
      status: 'Completed',
      timestamp: new Date().toISOString(),
    };

    onAddServiceTransaction(newSrv);
    setShowReceipt(newSrv);

    // Reset Form
    setBillAccount('');
    setBillName('');
    setBillAmount('');
  };

  // Submit Remittance
  const handleRemitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remitRecipient || !remitSender || !remitAmount) {
      alert('Punan ang sender, recipient, at halaga ng remittance.');
      return;
    }

    const amt = parseFloat(remitAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Maglagay ng tamang halaga.');
      return;
    }

    const fee = parseFloat(remitFee) || 0;
    const total = amt + fee;

    const newSrv: ServiceTransaction = {
      id: `SRV-${Date.now().toString().slice(-4)}`,
      branch: currentBranch,
      type: 'Remittance',
      provider: remitProvider,
      recipient: remitRecipient,
      senderOrAccountName: remitSender,
      amount: amt,
      serviceFee: fee,
      totalAmount: total,
      status: 'Completed',
      timestamp: new Date().toISOString(),
    };

    onAddServiceTransaction(newSrv);
    setShowReceipt(newSrv);

    // Reset Form
    setRemitRecipient('');
    setRemitSender('');
    setRemitAmount('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-stretch">
      {/* Quick service selector & form column (7 cols) */}
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Navigation Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/75 flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('load')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'load'
                  ? 'bg-silang-blue text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              <Smartphone className="h-4 w-4" />
              <span>📱 E-Load / Promo</span>
            </button>
            <button
              onClick={() => setActiveTab('bills')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'bills'
                  ? 'bg-silang-blue text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              <Receipt className="h-4 w-4" />
              <span>🧾 Bayad Bills</span>
            </button>
            <button
              onClick={() => setActiveTab('remit')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'remit'
                  ? 'bg-silang-blue text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              <Send className="h-4 w-4" />
              <span>💸 Pera Padala / Cash-in</span>
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-xs font-semibold text-slate-600">
            <span>Branch:</span>
            <select
              value={currentBranch}
              onChange={(e) => onBranchChange(e.target.value as Branch)}
              className="bg-transparent font-bold outline-none cursor-pointer"
            >
              <option value="Poblacion">Poblacion</option>
              <option value="Bypass">Bypass Road</option>
            </select>
          </div>
        </div>

        {/* Tab contents panel */}
        <div className="flex-1 p-6 overflow-y-auto min-h-[350px]">
          {/* TAB 1: E-LOAD */}
          {activeTab === 'load' && (
            <div className="max-w-md mx-auto space-y-4">
              <div className="text-center">
                <h4 className="font-bold text-slate-800 text-base">Electronic Loading Station</h4>
                <p className="text-xs text-slate-400">Direktang mag-load ng Smart, Globe, TNT, at DITO</p>
              </div>

              <form onSubmit={handleLoadSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Pumili ng Telecommunication Network:</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['Smart', 'Globe', 'TNT', 'DITO'].map((net) => (
                      <button
                        key={net}
                        type="button"
                        onClick={() => {
                          setLoadNetwork(net);
                          setLoadPromo(loadPromosByNetwork[net][0].value);
                        }}
                        className={`py-2 font-bold rounded-lg border text-center transition-all cursor-pointer ${
                          loadNetwork === net
                            ? 'bg-silang-blue text-white border-silang-blue shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {net}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Customer Phone Number (11-digits) *</label>
                  <input
                    type="tel"
                    maxLength={11}
                    required
                    placeholder="E.g. 09171234567"
                    value={loadPhone}
                    onChange={(e) => setLoadPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2.5 border rounded-lg bg-white text-base font-bold font-mono tracking-wider text-center"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Pumili ng Promo o Halaga:</label>
                    <select
                      value={loadPromo}
                      onChange={(e) => setLoadPromo(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white font-bold"
                    >
                      {loadPromosByNetwork[loadNetwork].map((p) => (
                        <option key={p.label} value={p.value}>
                          {p.label} (₱{p.value})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Patong / Service Fee (₱)</label>
                    <input
                      type="number"
                      required
                      value={loadFee}
                      onChange={(e) => setLoadFee(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white font-bold text-center"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border flex justify-between items-center font-bold text-slate-700">
                  <span>Kabuuang Sisingilin sa Customer:</span>
                  <span className="text-base text-silang-blue font-mono">
                    ₱{(parseFloat(loadPromo) + (parseFloat(loadFee) || 0)).toFixed(2)}
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-silang-blue hover:bg-silang-blue-dark text-white font-bold rounded-xl shadow cursor-pointer text-xs"
                >
                  I-send ang Load at I-print Resibo
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: BAYAD BILLS */}
          {activeTab === 'bills' && (
            <div className="max-w-md mx-auto space-y-4">
              <div className="text-center">
                <h4 className="font-bold text-slate-800 text-base">Over-the-Counter Bills Payment</h4>
                <p className="text-xs text-slate-400">Mabilisang pagbabayad ng kuryente, tubig, at internet</p>
              </div>

              <form onSubmit={handleBillSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Bill Provider / Kumpanya:</label>
                    <select
                      value={billProvider}
                      onChange={(e) => setBillProvider(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white font-bold"
                    >
                      <option value="Meralco (Electricity)">Meralco (Kuryente)</option>
                      <option value="Silang Water District">Silang Water (Tubig)</option>
                      <option value="PLDT Home Fibra">PLDT Home</option>
                      <option value="Globe At Home Broadband">Globe Broadband</option>
                      <option value="Cignal Cable TV">Cignal TV</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Patong / Convenience Fee (₱)</label>
                    <input
                      type="number"
                      required
                      value={billFee}
                      onChange={(e) => setBillFee(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white font-bold text-center"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-slate-500 font-semibold mb-1">Account Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="E.g. 1234-5678-9012"
                      value={billAccount}
                      onChange={(e) => setBillAccount(e.target.value)}
                      className="w-full px-3 py-2.5 border rounded-lg bg-white font-bold font-mono tracking-wider text-center"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-slate-500 font-semibold mb-1">Pangalan sa Account *</label>
                    <input
                      type="text"
                      required
                      placeholder="E.g. Mang Tomas Dela Cruz"
                      value={billName}
                      onChange={(e) => setBillName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white font-medium"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-slate-500 font-semibold mb-1">Halaga ng Bill (₱) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₱</span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="E.g. 1500"
                        value={billAmount}
                        onChange={(e) => setBillAmount(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 border rounded-lg bg-white text-base font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border flex justify-between items-center font-bold text-slate-700">
                  <span>Kabuuang Sisingilin sa Customer:</span>
                  <span className="text-base text-silang-blue font-mono">
                    ₱{(parseFloat(billAmount || '0') + (parseFloat(billFee) || 0)).toFixed(2)}
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-silang-blue hover:bg-silang-blue-dark text-white font-bold rounded-xl shadow cursor-pointer text-xs"
                >
                  I-proseso ang Bill Payment at I-print Resibo
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: REMITTANCE */}
          {activeTab === 'remit' && (
            <div className="max-w-md mx-auto space-y-4">
              <div className="text-center">
                <h4 className="font-bold text-slate-800 text-base">Remittance & E-Wallet Over-the-Counter</h4>
                <p className="text-xs text-slate-400">Palawan Express, Cebuana, GCash Cash-in, Maya Cash-in</p>
              </div>

              <form onSubmit={handleRemitSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Remittance / Cash-in Service:</label>
                    <select
                      value={remitProvider}
                      onChange={(e) => setRemitProvider(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white font-bold"
                    >
                      <option value="GCash Cash-In">GCash Cash-In (Deposit)</option>
                      <option value="Maya Cash-In">Maya Cash-In (Deposit)</option>
                      <option value="Palawan Express Padala">Palawan Express Padala</option>
                      <option value="Cebuana Lhuillier">Cebuana Lhuillier</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Remittance Fee / Bayad (₱)</label>
                    <input
                      type="number"
                      required
                      value={remitFee}
                      onChange={(e) => setRemitFee(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white font-bold text-center"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Sender o Magpapadalang Customer *</label>
                    <input
                      type="text"
                      required
                      placeholder="E.g. Juan Dela Cruz"
                      value={remitSender}
                      onChange={(e) => setRemitSender(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Tatanggap / Recipient (E-Wallet No. / Name) *</label>
                    <input
                      type="text"
                      required
                      placeholder="E.g. 0917-222-3333 o Maria Santos"
                      value={remitRecipient}
                      onChange={(e) => setRemitRecipient(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Halaga ng Padala o Cash-in (₱) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₱</span>
                      <input
                        type="number"
                        required
                        placeholder="E.g. 2000"
                        value={remitAmount}
                        onChange={(e) => setRemitAmount(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 border rounded-lg bg-white text-base font-bold text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border flex justify-between items-center font-bold text-slate-700">
                  <span>Kabuuang Sisingilin sa Customer:</span>
                  <span className="text-base text-silang-blue font-mono">
                    ₱{(parseFloat(remitAmount || '0') + (parseFloat(remitFee) || 0)).toFixed(2)}
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-silang-blue hover:bg-silang-blue-dark text-white font-bold rounded-xl shadow cursor-pointer text-xs"
                >
                  I-proseso ang Remittance at I-print Resibo
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Transaction log history column (5 cols) */}
      <div className="lg:col-span-5 xl:col-span-4 flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/75">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
            Ledger ng Serbisyo ({serviceTransactions.length})
          </h3>
          <p className="text-[10px] text-slate-400">Kasaysayan ng mga e-load, bills, at remittance</p>
        </div>

        {/* List of service transactions */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
          {serviceTransactions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 h-full flex flex-col justify-center">
              Walang nakatalang transaksyon ng mga serbisyo ngayon.
            </div>
          ) : (
            serviceTransactions.map((srv) => (
              <div
                key={srv.id}
                onClick={() => setShowReceipt(srv)}
                className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-100 transition-colors cursor-pointer flex flex-col justify-between"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-400">
                      {srv.id}
                    </span>
                    <h5 className="font-bold text-slate-800 text-xs mt-1">{srv.provider}</h5>
                    <p className="text-[10px] text-slate-500 font-mono">Para kay: {srv.recipient}</p>
                  </div>

                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                      srv.type === 'E-Load'
                        ? 'bg-blue-50 text-blue-600'
                        : srv.type === 'Bills Payment'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-green-50 text-green-600'
                    }`}
                  >
                    {srv.type}
                  </span>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex justify-between items-center text-xs">
                  <span className="text-[10px] text-slate-400">
                    {new Date(srv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {srv.branch}
                  </span>
                  <span className="font-bold text-slate-800 font-mono">
                    ₱{srv.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SERVICE TRANSACTION RECEIPT DIALOG MODAL */}
      {showReceipt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 flex flex-col justify-between max-h-[90vh] overflow-hidden">
            {/* Receipts printable text */}
            <div className="flex-1 overflow-y-auto pr-1 text-center font-mono text-xs text-slate-800 space-y-4">
              <div className="space-y-1">
                <span className="text-xl">🌅</span>
                <h2 className="text-base font-black font-display tracking-tight text-silang-blue uppercase">
                  SILANG MINI MART
                </h2>
                <span className="text-[10px] font-bold text-silang-green uppercase tracking-widest">
                  Value Added Services Receipt
                </span>
                <p className="text-[10px] text-slate-400">{showReceipt.branch} Branch</p>
              </div>

              <div className="border-y border-dashed border-slate-200 py-2 text-left text-[10px] space-y-0.5 text-slate-500">
                <div className="flex justify-between">
                  <span>RESIDU ID:</span>
                  <span>{showReceipt.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>URI NG SERBISYO:</span>
                  <span>{showReceipt.type.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span>PROVIDER:</span>
                  <span>{showReceipt.provider.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span>PETSA:</span>
                  <span>{new Date(showReceipt.timestamp).toLocaleString('en-PH')}</span>
                </div>
              </div>

              <div className="text-left text-[11px] space-y-1.5 p-2 bg-slate-50 rounded border">
                <div className="flex justify-between text-slate-500">
                  <span>SENDER / CUSTOMER:</span>
                  <span className="font-bold text-slate-700">{showReceipt.senderOrAccountName}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>RECIPIENT / NO:</span>
                  <span className="font-bold text-slate-800">{showReceipt.recipient}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-200 pt-2 text-right space-y-1 text-slate-700">
                <div className="flex justify-between">
                  <span>HALAGA NG PADALA/BILL:</span>
                  <span>₱{showReceipt.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>CONVENIENCE / SERBISYO FEE:</span>
                  <span>₱{showReceipt.serviceFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-extrabold text-sm border-t border-dashed border-slate-200 pt-1 text-slate-900">
                  <span>KABUUANG SINGIL:</span>
                  <span>₱{showReceipt.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-200 pt-3 text-center space-y-1 text-[10px] text-slate-400">
                <p className="font-bold text-slate-500">Salamat po sa pagtitiwala sa aming serbisyo!</p>
                <p>Silang Mini Mart 🌅 Palaging Maaasahan</p>
              </div>
            </div>

            {/* Receipt Modal CTAs */}
            <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="py-2 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-1.5 cursor-pointer text-slate-600"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>I-print</span>
              </button>
              <button
                type="button"
                onClick={() => setShowReceipt(null)}
                className="py-2 text-xs font-bold rounded-lg bg-silang-blue hover:bg-silang-blue-dark text-white flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                <span>Tapos Na</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
