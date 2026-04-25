import React, { useState, useEffect, useMemo } from 'react';

interface CashBreakdownProps {
  onChange: (total: number, breakdown: Record<string, number>) => void;
  initialBreakdown?: Record<string, number>;
}

const DENOMINATIONS = [
  { label: '$100 Note', value: 100, type: 'note' },
  { label: '$50 Note', value: 50, type: 'note' },
  { label: '$20 Note', value: 20, type: 'note' },
  { label: '$10 Note', value: 10, type: 'note' },
  { label: '$5 Note', value: 5, type: 'note' },
  { label: '$2 Coin', value: 2, type: 'coin' },
  { label: '$1 Coin', value: 1, type: 'coin' },
  { label: '50c Coin', value: 0.5, type: 'coin' },
  { label: '20c Coin', value: 0.2, type: 'coin' },
  { label: '10c Coin', value: 0.1, type: 'coin' },
  { label: '5c Coin', value: 0.05, type: 'coin' },
];

export const CashBreakdown: React.FC<CashBreakdownProps> = ({ onChange, initialBreakdown }) => {
  const [counts, setCounts] = useState<Record<string, number>>(
    initialBreakdown || 
    DENOMINATIONS.reduce((acc, den) => ({ ...acc, [den.value.toString()]: 0 }), {})
  );

  const total = useMemo(() => {
    return Object.entries(counts).reduce((acc, [val, count]) => {
      return acc + parseFloat(val) * count;
    }, 0);
  }, [counts]);

  useEffect(() => {
    onChange(total, counts);
  }, [total, counts, onChange]);

  const handleInputChange = (val: string, countStr: string) => {
    const count = parseInt(countStr) || 0;
    setCounts(prev => ({ ...prev, [val]: Math.max(0, count) }));
  };

  const notes = DENOMINATIONS.filter(d => d.type === 'note');
  const coins = DENOMINATIONS.filter(d => d.type === 'coin');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Notes Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-2 h-4 bg-emerald-500 rounded-full"></span>
            Australian Notes
          </h4>
          <div className="space-y-2">
            {notes.map(den => (
              <div key={den.value} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white shadow-sm hover:border-emerald-200 transition-colors">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-700">{den.label}</span>
                  <span className="text-xs text-gray-400">Value: ${den.value.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    value={counts[den.value.toString()] || ''}
                    onChange={(e) => handleInputChange(den.value.toString(), e.target.value)}
                    placeholder="0"
                    className="w-20 px-3 py-2 text-right text-sm font-semibold bg-gray-50 border-transparent rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
                  />
                  <div className="w-24 text-right">
                    <span className="text-sm font-bold text-gray-900">
                      ${((counts[den.value.toString()] || 0) * den.value).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coins Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-2 h-4 bg-amber-500 rounded-full"></span>
            Australian Coins
          </h4>
          <div className="space-y-2">
            {coins.map(den => (
              <div key={den.value} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white shadow-sm hover:border-amber-200 transition-colors">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-700">{den.label}</span>
                  <span className="text-xs text-gray-400">Value: ${den.value.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    value={counts[den.value.toString()] || ''}
                    onChange={(e) => handleInputChange(den.value.toString(), e.target.value)}
                    placeholder="0"
                    className="w-20 px-3 py-2 text-right text-sm font-semibold bg-gray-50 border-transparent rounded-lg focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all outline-none"
                  />
                  <div className="w-24 text-right">
                    <span className="text-sm font-bold text-gray-900">
                      ${((counts[den.value.toString()] || 0) * den.value).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Cash Counted</span>
          <div className="text-3xl font-black tabular-nums tracking-tight">
            ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white/10 p-3 rounded-xl backdrop-blur-md">
          <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
    </div>
  );
};
