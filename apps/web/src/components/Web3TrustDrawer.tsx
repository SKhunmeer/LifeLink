'use client';

import React, { useState } from 'react';
import { X, Shield, Link, CheckCircle2, Lock, ExternalLink } from 'lucide-react';

interface Web3TrustDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Web3TrustDrawer: React.FC<Web3TrustDrawerProps> = ({ isOpen, onClose }) => {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('0x71C...4e8B');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white text-slate-900 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Web3 Blockchain Trust Layer</h3>
                <p className="text-[10px] text-slate-500">Polygon Amoy Testnet • Immutable Registry</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Wallet Status */}
            <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900">Polygon Amoy Connection</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                  TESTNET (CHAIN ID 80002)
                </span>
              </div>
              <p className="text-xs text-indigo-800/80">
                The smart contract provides a decentralized, tamper-proof interval registry to prevent unsafe over-donation without exposing any patient or donor PII.
              </p>
              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs font-mono text-indigo-950 font-bold">
                  {walletConnected ? walletAddress : 'Demo Verifier Wallet'}
                </span>
                <button
                  onClick={() => setWalletConnected(!walletConnected)}
                  className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition"
                >
                  {walletConnected ? 'Disconnect' : 'Connect Wallet'}
                </button>
              </div>
            </div>

            {/* Smart Contract Specifications */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Contract Details</h4>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2 font-mono">
                <div>
                  <div className="text-[10px] text-slate-400 font-sans">Contract Name:</div>
                  <div className="font-bold text-slate-800">DonationEligibilityRegistry.sol</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-sans">Configured Recovery Interval:</div>
                  <div className="text-emerald-700 font-bold">56 Days (4,838,400 seconds)</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-sans">Pseudonymous Donor Hash:</div>
                  <div className="text-slate-600 truncate text-[11px]">
                    keccak256(bytes("donor-uuid-001"))
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-sans">Authorized Hospital Roles:</div>
                  <div className="text-slate-700">Metro General (0x3a8...B91) [Authorized]</div>
                </div>
              </div>
            </div>

            {/* Privacy Architecture Notice */}
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-2 text-xs">
              <div className="flex items-center space-x-1.5 font-bold text-amber-900">
                <Lock className="w-4 h-4 text-amber-700" />
                <span>Zero On-Chain PII Guarantee</span>
              </div>
              <ul className="text-amber-800/90 space-y-1 list-disc pl-4 text-[11px]">
                <li>Donor names, phone numbers, and addresses are NEVER placed on-chain.</li>
                <li>Patient medical diagnosis and emergency identities remain strictly off-chain.</li>
                <li>Ordinary donors and patients never pay gas fees.</li>
              </ul>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-400 text-center">
            Blockchain verification layer is optional — application works 100% offline via SQLite/Postgres.
          </div>
        </div>
      </div>
    </div>
  );
};
