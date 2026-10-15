import { useState, useEffect } from 'react';
import { Modal } from './ui';
import { APP_BRAND_POS_LINE } from '../constants/branding';

export default function DocumentationModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (window.electronAPI?.ipcRenderer) {
      const handleShow = () => setIsOpen(true);
      window.electronAPI.ipcRenderer.on('app:showDocumentation', handleShow);
      
      return () => {
        window.electronAPI.ipcRenderer?.removeListener('app:showDocumentation', handleShow);
      };
    }
  }, []);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={`${APP_BRAND_POS_LINE} - Documentation`} size="lg">
      <div className="p-6 text-gray-800" style={{ maxHeight: '65vh', overflowY: 'auto', lineHeight: '1.6' }}>
        <h2 className="text-2xl font-bold mb-4 text-brand-dark">User Guide & Documentation</h2>
        
        <p className="mb-4">
          Welcome to the <strong>{APP_BRAND_POS_LINE}</strong> platform! This system is designed to streamline your retail operations effortlessly. Below is a quick overview of the modules available in the application.
        </p>

        <div className="space-y-6">
          <section>
            <h3 className="text-lg font-semibold text-brand mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
              Dashboard
            </h3>
            <p className="text-sm text-gray-600">The central hub for your business. View top-level realtime metrics, daily earnings, stock warnings, and comparative graphs detailing the health of your storefront.</p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-brand mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
              Products & Inventory
            </h3>
            <p className="text-sm text-gray-600">Add new items into your catalog, manage SKUs, barcode numbers, inventory margins, and establish bulk prices. Easily track real-time stock deductions immediately upon successful checkouts.</p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-brand mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              Point of Sale (POS)
            </h3>
            <p className="text-sm text-gray-600">The retail interface for the Cashier. Quickly scan product barcodes, queue physical cart items, apply bulk promotional discounts, and handle transactions using Cash, Card, or Hybrid splits.</p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-brand mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Reports & Logs
            </h3>
            <p className="text-sm text-gray-600">Export highly detailed end-of-day tabular data natively to printable formats or XLSX sheets mapping historical profits against expenditures cleanly.</p>
          </section>
        </div>

        <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
          <svg className="w-6 h-6 text-indigo-500 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <div className="font-medium text-sm text-gray-700">
            For dedicated technical assistance, password resets, or database rollbacks, please immediately contact your designated System Administrator or refer to the internal network deployment handbook.
          </div>
        </div>
      </div>
    </Modal>
  );
}
