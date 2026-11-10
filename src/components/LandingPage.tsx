/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

const STORE_BG_IMAGE_URL = '/uploads/store-pictures/store-1783745792232-4766ab9458813.webp';

type LandingPageProps = {
  onOpenLogin?: (opts: { defaultTab: 'admin' | 'customer' | 'rider' | 'supplier'; defaultMode?: 'login' | 'register' }) => void;
};

export default function LandingPage({ onOpenLogin }: LandingPageProps) {
  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const goToPortal = () => {
    // Non-breaking: keep current SPA behavior.
    // This project currently routes roles inside App; since landing is shown when logged out,
    // we provide a gentle UX action that focuses the user on the customer portal section.
    scrollToId('customer-portal');
  };

  const goToStaff = () => {
    // If you later add a staff-login page, replace this with a proper route.
    scrollToId('staff');
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${STORE_BG_IMAGE_URL})` }}
      />

      {/* Gradient + dim for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/55" />

      <div className="relative z-10 min-h-screen">
        {/* Subtle animated glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-orange-500/20 blur-3xl animate-[pulse_4s_ease-in-out_infinite]"
        />

        {/* Top bar */}
        <header className="px-5 sm:px-10 pt-6">
          <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md shadow-orange-500/20 tracking-tighter overflow-hidden bg-white/10 border border-white/10">
                <img
                  src="/uploads/store-pictures/silanglogo.png"
                  alt="Silang Mini Mart"
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              </div>
              <div>
                <div className="text-[10px] sm:text-xs font-black text-white/90 uppercase tracking-widest">
                  Silang Mini Mart
                </div>
                <div className="text-[9px] sm:text-[10px] font-bold text-slate-200/90">
                  Digital Portal • Digi-Grocer V1
                </div>
              </div>
            </div>


            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollToId('features')}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-[11px] font-black uppercase tracking-widest transition-colors"
              >
                Features
              </button>
              <button
                type="button"
                onClick={() => scrollToId('how-it-works')}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-[11px] font-black uppercase tracking-widest transition-colors"
              >
                How it works
              </button>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="px-5 sm:px-10 pt-10 sm:pt-14">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 border border-white/15 text-white/90">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest">
                  System Online
                </span>
              </div>

              <h1 className="mt-5 text-white font-black font-display tracking-tight drop-shadow text-4xl sm:text-5xl leading-[1.03]">
                Welcome to a faster
                <span className="text-orange-300"> Silang Mini Mart</span>
              </h1>

              <p className="mt-4 text-white/85 text-sm sm:text-base font-bold leading-relaxed">
                POS, Inventory, GPS Delivery Tracking, and Value-Added Services—wrapped in one interactive portal.
              </p>

              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => onOpenLogin?.({ defaultTab: 'customer', defaultMode: 'login' })}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-widest px-6 py-3 rounded-xl shadow-md shadow-orange-500/20 transition-all active:scale-[0.99]"
                >
                  Customer Login
                </button>
                <button
                  type="button"
                  onClick={() => onOpenLogin?.({ defaultTab: 'supplier', defaultMode: 'login' })}
                  className="bg-emerald-500/90 hover:bg-emerald-600 text-white font-black uppercase tracking-widest px-6 py-3 rounded-xl shadow-md transition-all active:scale-[0.99]"
                >
                  Supplier Login
                </button>
                <button
                  type="button"
                  onClick={() => onOpenLogin?.({ defaultTab: 'customer', defaultMode: 'register' })}
                  className="bg-white/10 hover:bg-white/15 text-white font-black uppercase tracking-widest px-6 py-3 rounded-xl border border-white/15 transition-all active:scale-[0.99]"
                >
                  Register (Customer)
                </button>
                <button
                  type="button"
                  onClick={() => onOpenLogin?.({ defaultTab: 'admin', defaultMode: 'login' })}
                  className="bg-white/10 hover:bg-white/15 text-white font-black uppercase tracking-widest px-6 py-3 rounded-xl border border-white/15 transition-all active:scale-[0.99] sm:hidden"
                >
                  Staff / POS Login
                </button>
              </div>


              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[{ k: 'POS', v: 'Checkout' }, { k: 'Inventory', v: 'Low Stock Alerts' }, { k: 'GPS', v: 'Live Tracking' }].map(
                  (item) => (
                    <div
                      key={item.k}
                      className="rounded-2xl bg-white/10 border border-white/15 p-3 backdrop-blur-sm hover:bg-white/12 transition-colors"
                    >
                      <div className="text-[10px] uppercase tracking-widest font-black text-white/70">
                        {item.k}
                      </div>
                      <div className="text-white font-black text-sm mt-1">{item.v}</div>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="relative">
              {/* Decorative card */}
              <div className="rounded-3xl bg-white/10 border border-white/15 backdrop-blur-sm shadow-2xl overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-white font-black uppercase tracking-widest text-[11px]">Quick Preview</div>
                      <div className="text-white/80 text-sm font-bold mt-1">What your portal can do</div>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-400/30 flex items-center justify-center text-white font-black">
                      ✦
                    </div>
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  <div id="customer-portal" className="scroll-mt-24" />
                  <div className="space-y-3">
                    {[
                      {
                        title: 'Order online',
                        desc: 'Choose products and place delivery orders from anywhere.',
                        badge: 'Customer'
                      },
                      {
                        title: 'Live GPS ETA',
                        desc: 'Track rider/delivery progress with map + status updates.',
                        badge: 'Delivery'
                      },
                      {
                        title: 'Fast support',
                        desc: 'Load/bills/padala with clean service transaction flow.',
                        badge: 'Services'
                      }
                    ].map((row) => (
                      <div
                        key={row.title}
                        className="group rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                      >
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-white font-black text-sm">{row.title}</div>
                              <div className="text-white/75 text-xs font-bold mt-1 leading-relaxed">
                                {row.desc}
                              </div>
                            </div>
                            <div className="text-[10px] uppercase tracking-widest font-black text-orange-200 bg-orange-500/15 border border-orange-400/25 px-2.5 py-1 rounded-full">
                              {row.badge}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 text-white/70 text-[10px] font-bold leading-relaxed">
                    Tip: Use the sections below to explore features. Buttons here are safe and won’t break current routing.
                  </div>
                </div>
              </div>

              {/* Staff anchor */}
              <div id="staff" className="scroll-mt-24" />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="px-5 sm:px-10 mt-14 sm:mt-20">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <div className="text-white/70 text-[10px] sm:text-xs uppercase tracking-widest font-black">
                  Features
                </div>
                <h2 className="text-white font-black font-display tracking-tight text-2xl sm:text-3xl mt-2">
                  Built for speed, clarity, and control
                </h2>
              </div>
              <button
                type="button"
                onClick={() => scrollToId('how-it-works')}
                className="bg-white/10 hover:bg-white/15 text-white font-black uppercase tracking-widest px-4 py-2 rounded-xl border border-white/15 transition-colors"
              >
                See how it works →
              </button>
            </div>

            <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  title: 'Cash Register / POS',
                  desc: 'Checkout flow with stock-aware alerts.'
                },
                {
                  title: 'Stocks & Inventory',
                  desc: 'Adjust inventory and handle low-stock quickly.'
                },
                {
                  title: 'GPS Delivery Tracker',
                  desc: 'Live driver updates and map-based monitoring.'
                },
                {
                  title: 'Load, Bills & Padala',
                  desc: 'Value-added services with consistent transactions.'
                }
              ].map((f) => (
                <div
                  key={f.title}
                  className="rounded-3xl bg-white/10 border border-white/15 backdrop-blur-sm p-5 transition-transform hover:-translate-y-1 hover:bg-white/12"
                >
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-400/30 flex items-center justify-center text-white font-black">
                    ✓
                  </div>
                  <div className="text-white font-black text-base mt-4">{f.title}</div>
                  <div className="text-white/75 text-sm font-bold mt-2 leading-relaxed">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="px-5 sm:px-10 mt-14 sm:mt-20">
          <div className="max-w-7xl mx-auto">
            <div className="text-white/70 text-[10px] sm:text-xs uppercase tracking-widest font-black">
              How it works
            </div>
            <h2 className="text-white font-black font-display tracking-tight text-2xl sm:text-3xl mt-2">
              From stock to delivery—without the confusion
            </h2>

            <div className="mt-8 grid md:grid-cols-3 gap-4">
              {[
                { n: '01', t: 'Choose your portal', d: 'Customer portal for ordering and GPS tracking; staff portal for POS & inventory.' },
                { n: '02', t: 'Run transactions', d: 'POS checkout or service transactions update your system records.' },
                { n: '03', t: 'Monitor delivery & stock', d: 'Get alerts for low stock and track delivery progress in real time.' }
              ].map((step) => (
                <div
                  key={step.n}
                  className="rounded-3xl bg-white/10 border border-white/15 p-6 backdrop-blur-sm"
                >
                  <div className="text-orange-200 font-black tracking-widest text-[12px]">{step.n}</div>
                  <div className="text-white font-black text-lg mt-2">{step.t}</div>
                  <div className="text-white/75 text-sm font-bold mt-2 leading-relaxed">{step.d}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits / Footer */}
        <footer className="px-5 sm:px-10 mt-14 sm:mt-20 pb-10">
          <div className="max-w-7xl mx-auto">
            <div className="rounded-3xl bg-white/10 border border-white/15 backdrop-blur-sm p-6 sm:p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                  <div className="text-white/70 text-[10px] sm:text-xs uppercase tracking-widest font-black">
                    Benefits
                  </div>
                  <h3 className="text-white font-black font-display tracking-tight text-2xl sm:text-3xl mt-2">
                    Simple for customers. Powerful for staff.
                  </h3>
                  <p className="text-white/80 font-bold mt-3 text-sm leading-relaxed">
                    This is an upgraded landing experience—interactive CTAs and clear feature previews—without breaking your existing app routing.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => scrollToId('features')}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-widest px-6 py-3 rounded-xl shadow-md shadow-orange-500/20 transition-all active:scale-[0.99]"
                  >
                    Explore Features
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToId('how-it-works')}
                    className="bg-white/10 hover:bg-white/15 text-white font-black uppercase tracking-widest px-6 py-3 rounded-xl border border-white/15 transition-colors active:scale-[0.99]"
                  >
                    How it works
                  </button>
                </div>
              </div>

              <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
                <div className="text-white/60 text-[10px] font-bold">
                  SILANG MINI MART • DIGI-GROCER V1.0.4
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {['Fast UI', 'Clear Sections', 'Mobile Friendly', 'Non-breaking CTAs'].map((b) => (
                    <span
                      key={b}
                      className="text-white/80 text-[10px] font-black uppercase tracking-widest bg-white/10 border border-white/15 px-3 py-1 rounded-full"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}


