
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import LoginView from './LoginView';
import { Product, Delivery } from '../types';

type LoginUserRole = 'admin' | 'customer' | 'rider' | 'supplier';

type Props = {
  open: boolean;
  onClose: () => void;

  defaultTab: LoginUserRole;
  defaultMode?: 'login' | 'register';

  customers: {
    name: string;
    phone: string;
    barangay: string;
    address: string;
    coordinates: [number, number];
    storeImage?: string | null;
    pin?: string;
  }[];

  onRegisterCustomer: (newCustomer: {
    name: string;
    phone: string;
    barangay: string;
    address: string;
    coordinates: [number, number];
    pin: string;
    storeImage: string | null;
  }) => Promise<any> | any;

  branchCoordinates: Record<string, [number, number]>;

  onLoginSuccess: (user: { username: string; role: LoginUserRole; name: string }) => void;
};

export default function LandingAuthModal({
  open,
  onClose,
  defaultTab,
  defaultMode = 'login',
  customers,
  onRegisterCustomer,
  branchCoordinates,
  onLoginSuccess,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200]">
      <button
        type="button"
        aria-label="Close login modal"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/*
        Center modal within the viewport and make sure the content never gets cut off.
        - items-center: vertical centering
        - overflow-y-auto: allow scrolling inside the modal
        - max-h-[90vh]: constrain height for mobile
      */}
      <div className="relative min-h-full flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div className="w-full max-w-3xl">
          <div className="bg-transparent">
            <LoginView
              defaultTab={defaultTab}
              defaultMode={defaultMode}
              onClose={onClose}
              customers={customers as any}
              onRegisterCustomer={onRegisterCustomer as any}
              branchCoordinates={branchCoordinates as any}
              onLoginSuccess={onLoginSuccess as any}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

