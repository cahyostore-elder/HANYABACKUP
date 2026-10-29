import {
  Wallet, Building2, CreditCard, Landmark, Construction, QrCode,
} from 'lucide-react';

export type PaymentMethod = {
  id: string;
  group: 'ewallet' | 'bank' | 'va' | 'qris';
  name: string;
  accountNumber: string;
  accountHolder: string;
  icon: typeof Wallet;
  color: string;
  maintenance?: boolean;
  note?: string;
};

// Payment destinations are retained as provided in the original project.
const E_WALLET_NUMBER = '082228307663';
const E_WALLET_HOLDER = 'FityoraStore';

export const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'dana', group: 'ewallet', name: 'DANA', accountNumber: E_WALLET_NUMBER, accountHolder: E_WALLET_HOLDER, icon: Wallet, color: '#0080FF' },
  { id: 'gopay', group: 'ewallet', name: 'GoPay', accountNumber: E_WALLET_NUMBER, accountHolder: E_WALLET_HOLDER, icon: Wallet, color: '#00AED6' },
  { id: 'ovo', group: 'ewallet', name: 'OVO', accountNumber: E_WALLET_NUMBER, accountHolder: E_WALLET_HOLDER, icon: Wallet, color: '#4C2A86' },
  { id: 'shopeepay', group: 'ewallet', name: 'ShopeePay', accountNumber: E_WALLET_NUMBER, accountHolder: E_WALLET_HOLDER, icon: Wallet, color: '#EE4D2D' },
  {
    id: 'qris',
    group: 'qris',
    name: 'QRIS',
    accountNumber: '',
    accountHolder: 'CAHYO STORE, PULSA & TAGIHAN',
    icon: QrCode,
    color: '#22c55e',
    note: 'Pindai QRIS lalu masukkan nominal total pembayaran yang tertera.',
  },
  {
    id: 'va',
    group: 'va',
    name: 'Virtual Account (VA)',
    accountNumber: '',
    accountHolder: '',
    icon: CreditCard,
    color: '#64748b',
    maintenance: true,
    note: 'Metode Virtual Account sedang dalam pemeliharaan. Silakan pilih metode lain.',
  },
  {
    id: 'seabank',
    group: 'bank',
    name: 'SeaBank',
    accountNumber: '901964227508',
    accountHolder: 'FityoraStore',
    icon: Building2,
    color: '#22d3ee',
  },
];

// Fees are displayed in the checkout and independently enforced by the database RPC.
export const PAYMENT_FEE = 500; // Backward-compatible default for older components.

export function paymentFeeForMethod(methodId: string | null | undefined): number {
  if (methodId === 'qris') return 300;
  if (methodId === 'seabank') return 1000;
  if (methodId && ['dana', 'gopay', 'ovo', 'shopeepay'].includes(methodId)) return 500;
  return PAYMENT_FEE;
}

export function groupMethods(methods: PaymentMethod[]) {
  return {
    ewallet: methods.filter((m) => m.group === 'ewallet'),
    bank: methods.filter((m) => m.group === 'bank'),
    va: methods.filter((m) => m.group === 'va'),
    qris: methods.filter((m) => m.group === 'qris'),
  };
}

export function methodById(id: string | null): PaymentMethod | null {
  if (!id) return null;
  return PAYMENT_METHODS.find((m) => m.id === id) ?? null;
}

export { Landmark, Construction };
