'use client';

import React, { useState } from 'react';
import { X, Bell, Send, CheckCircle2, MessageSquare, AlertTriangle, ShieldAlert } from 'lucide-react';

interface NotificationSimulatorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: any[];
  onSendTestSms: (phone: string, message: string) => Promise<void>;
}

export const NotificationSimulatorDrawer: React.FC<NotificationSimulatorDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onSendTestSms
}) => {
  const [testPhone, setTestPhone] = useState('+1 (415) 555-0201');
  const [testMessage, setTestMessage] = useState(
    'BloodLink AI: A registered blood bank has a verified urgent request for O- Red Blood Cells near San Francisco. Review securely: https://bloodlink.ai/d/case-921. Reply STOP to opt out.'
  );
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const handleTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    try {
      await onSendTestSms(testPhone, testMessage);
    } catch (err: any) {
      alert(`Dispatch error: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 text-white shadow-2xl flex flex-col">
          {/* Drawer Header */}
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-rose-600/20 text-rose-400 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Emergency SMS Feed</h3>
                <p className="text-[10px] text-slate-400">Twilio SMS & Mock Sandbox Dispatch Log</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Test Dispatch Bar */}
          <div className="p-4 bg-slate-850 border-b border-slate-800">
            <div className="text-[11px] font-semibold text-rose-400 mb-2 flex items-center space-x-1">
              <Send className="w-3 h-3" />
              <span>Simulate Emergency SMS Dispatch</span>
            </div>
            <form onSubmit={handleTestSubmit} className="space-y-2">
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="Recipient Phone (+1 415 555-0201)"
                className="w-full text-xs rounded-lg bg-slate-900 border border-slate-700 text-white px-2.5 py-1.5"
                required
              />
              <textarea
                rows={2}
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Message template..."
                className="w-full text-xs rounded-lg bg-slate-900 border border-slate-700 text-white px-2.5 py-1.5"
                required
              />
              <button
                type="submit"
                disabled={isSending}
                className="w-full py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm"
              >
                {isSending ? 'Dispatching...' : 'Dispatch Sandbox Alert'}
              </button>
            </form>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Recent Dispatches ({notifications.length})
            </div>

            {notifications.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No notification alerts logged yet.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700 space-y-2"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center space-x-1.5">
                      <MessageSquare className="w-3 h-3 text-rose-400" />
                      <span className="font-mono text-slate-300 font-semibold">{notif.recipient_phone_masked}</span>
                    </div>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                        notif.status === 'sent' || notif.status === 'delivered'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                      }`}
                    >
                      {notif.status === 'mock_sent' ? 'MOCK SANDBOX' : notif.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed font-sans bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                    "{notif.message_body}"
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>SID: {notif.twilio_sid?.slice(0, 16) || 'SM_MOCK'}</span>
                    <span>{notif.created_at?.split('T')[1]?.slice(0, 8) || 'Just now'}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Notice */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-500 text-center">
            🔒 Donor phone numbers are masked for HIPAA privacy compliance.
          </div>
        </div>
      </div>
    </div>
  );
};
