import { useEffect, useState } from 'react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { KeyIcon, ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';
import { Terminal } from '../../../services/adminService';

interface PairingCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  terminal: Terminal | null;
  code: string | null;
  expiresAt: string | null;
}

function useCountdown(expiresAt: string | null): string {
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!expiresAt) {
      setLabel('');
      return;
    }
    const update = () => {
      const remainingMs = new Date(expiresAt).getTime() - Date.now();
      if (remainingMs <= 0) {
        setLabel('Expired');
        return;
      }
      const minutes = Math.floor(remainingMs / 60000);
      const seconds = Math.floor((remainingMs % 60000) / 1000);
      setLabel(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return label;
}

export default function PairingCodeModal({ isOpen, onClose, terminal, code, expiresAt }: PairingCodeModalProps) {
  const [copied, setCopied] = useState(false);
  const countdown = useCountdown(expiresAt);

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can fail (permissions, non-secure context) — non-critical, code is shown on screen regardless.
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Terminal Pairing Code" size="sm">
      <div className="space-y-4 text-center">
        <p className="text-sm text-gray-500">
          Enter this code on <span className="font-semibold text-gray-700">{terminal?.name}</span>'s physical machine —
          during Setup Wizard, or later from Admin Tools &rarr; This Terminal.
        </p>

        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl py-6">
          <div className="flex items-center justify-center gap-2">
            <KeyIcon className="w-5 h-5 text-secondary-500" />
            <span className="text-3xl font-mono font-bold tracking-widest text-gray-900">{code}</span>
          </div>
          <button
            onClick={handleCopy}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-secondary-600 hover:text-secondary-700"
          >
            {copied ? <CheckIcon className="w-3.5 h-3.5" /> : <ClipboardDocumentIcon className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy code'}
          </button>
        </div>

        <p className={`text-xs font-semibold ${countdown === 'Expired' ? 'text-red-500' : 'text-gray-400'}`}>
          {countdown === 'Expired' ? 'This code has expired — generate a new one.' : `Expires in ${countdown}`}
        </p>

        <Button onClick={onClose} variant="outline" size="sm" className="w-full">
          Done
        </Button>
      </div>
    </Modal>
  );
}
