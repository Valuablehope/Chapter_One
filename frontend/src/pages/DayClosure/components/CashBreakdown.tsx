import React, { useState, useEffect, useMemo } from 'react';

interface Denomination {
  label: string;
  value: number;
  currency: string;
  type: 'note' | 'coin';
}

interface CashBreakdownProps {
  currencyCode: string;
  lbpRate?: number | null;
  onChange: (total: number, breakdown: Record<string, number>) => void;
  initialBreakdown?: Record<string, number>;
}

const AUD_DENOMINATIONS: Denomination[] = [
  { label: '$100 Note', value: 100, currency: 'AUD', type: 'note' },
  { label: '$50 Note', value: 50, currency: 'AUD', type: 'note' },
  { label: '$20 Note', value: 20, currency: 'AUD', type: 'note' },
  { label: '$10 Note', value: 10, currency: 'AUD', type: 'note' },
  { label: '$5 Note', value: 5, currency: 'AUD', type: 'note' },
  { label: '$2 Coin', value: 2, currency: 'AUD', type: 'coin' },
  { label: '$1 Coin', value: 1, currency: 'AUD', type: 'coin' },
  { label: '50c Coin', value: 0.5, currency: 'AUD', type: 'coin' },
  { label: '20c Coin', value: 0.2, currency: 'AUD', type: 'coin' },
  { label: '10c Coin', value: 0.1, currency: 'AUD', type: 'coin' },
  { label: '5c Coin', value: 0.05, currency: 'AUD', type: 'coin' },
];

const USD_DENOMINATIONS: Denomination[] = [
  { label: '$100 Bill', value: 100, currency: 'USD', type: 'note' },
  { label: '$50 Bill', value: 50, currency: 'USD', type: 'note' },
  { label: '$20 Bill', value: 20, currency: 'USD', type: 'note' },
  { label: '$10 Bill', value: 10, currency: 'USD', type: 'note' },
  { label: '$5 Bill', value: 5, currency: 'USD', type: 'note' },
  { label: '$2 Bill', value: 2, currency: 'USD', type: 'note' },
  { label: '$1 Bill', value: 1, currency: 'USD', type: 'note' },
];

const LBP_DENOMINATIONS: Denomination[] = [
  { label: '100,000 LBP', value: 100000, currency: 'LBP', type: 'note' },
  { label: '50,000 LBP', value: 50000, currency: 'LBP', type: 'note' },
  { label: '20,000 LBP', value: 20000, currency: 'LBP', type: 'note' },
  { label: '10,000 LBP', value: 10000, currency: 'LBP', type: 'note' },
  { label: '5,000 LBP', value: 5000, currency: 'LBP', type: 'note' },
  { label: '1,000 LBP', value: 1000, currency: 'LBP', type: 'note' },
];

export const CashBreakdown: React.FC<CashBreakdownProps> = ({ 
  currencyCode, 
  lbpRate, 
  onChange, 
  initialBreakdown 
}) => {
  const denominations = useMemo(() => {
    if (currencyCode === 'AUD') return AUD_DENOMINATIONS;
    if (currencyCode === 'USD') {
      if (lbpRate && lbpRate > 0) {
        return [...USD_DENOMINATIONS, ...LBP_DENOMINATIONS];
      }
      return USD_DENOMINATIONS;
    }
    return USD_DENOMINATIONS; // Default to USD
  }, [currencyCode, lbpRate]);

  const [counts, setCounts] = useState<Record<string, number>>(() => {
    if (initialBreakdown) return initialBreakdown;
    const initial: Record<string, number> = {};
    denominations.forEach(d => {
      initial[`${d.currency}_${d.value}`] = 0;
    });
    return initial;
  });

  const total = useMemo(() => {
    return Object.entries(counts).reduce((acc, [key, count]) => {
      const [curr, valStr] = key.split('_');
      const val = parseFloat(valStr);
      if (curr === currencyCode) {
        return acc + val * count;
      } else if (curr === 'LBP' && currencyCode === 'USD' && lbpRate) {
        return acc + (val * count) / lbpRate;
      }
      return acc + val * count; // Fallback
    }, 0);
  }, [counts, currencyCode, lbpRate]);

  useEffect(() => {
    onChange(total, counts);
  }, [total, counts, onChange]);

  const handleInputChange = (key: string, countStr: string) => {
    const count = parseInt(countStr) || 0;
    setCounts(prev => ({ ...prev, [key]: Math.max(0, count) }));
  };

  const primaryDenoms = denominations.filter(d => d.currency === currencyCode);
  const secondaryDenoms = denominations.filter(d => d.currency !== currencyCode);

  const getSectionTitle = (curr: string) => {
    if (curr === 'AUD') return 'Australian Currency';
    if (curr === 'USD') return 'US Dollar Bills';
    if (curr === 'LBP') return 'Lebanese Pound Notes';
    return `${curr} Currency`;
  };

  const renderSection = (title: string, denoms: Denomination[], color: string) => (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
        <span className={`w-2 h-4 ${color} rounded-full`}></span>
        {title}
      </h4>
      <div className="space-y-2">
        {denoms.map(den => {
          const key = `${den.currency}_${den.value}`;
          return (
            <div key={key} className={`flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white shadow-sm hover:border-${color.split('-')[1]}-200 transition-colors`}>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-700">{den.label}</span>
                <span className="text-xs text-gray-400">
                  {den.currency} {den.value.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  value={counts[key] || ''}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  placeholder="0"
                  className="w-20 px-3 py-2 text-right text-sm font-semibold bg-gray-50 border-transparent rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
                />
                <div className="w-24 text-right">
                  <span className="text-sm font-bold text-gray-900">
                    {den.currency === 'LBP' ? '' : '$'}{((counts[key] || 0) * den.value).toLocaleString(undefined, { minimumFractionDigits: den.currency === 'LBP' ? 0 : 2 })}
                    {den.currency === 'LBP' ? ' L' : ''}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {currencyCode === 'AUD' ? (
          <>
            {renderSection('Australian Notes', primaryDenoms.filter(d => d.type === 'note'), 'bg-emerald-500')}
            {renderSection('Australian Coins', primaryDenoms.filter(d => d.type === 'coin'), 'bg-amber-500')}
          </>
        ) : (
          <>
            {renderSection(getSectionTitle(currencyCode), primaryDenoms, 'bg-blue-500')}
            {secondaryDenoms.length > 0 && renderSection(getSectionTitle(secondaryDenoms[0].currency), secondaryDenoms, 'bg-amber-500')}
          </>
        )}
      </div>

      <div className="mt-6 p-4 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Total {currencyCode} Counted
            {lbpRate && secondaryDenoms.some(d => d.currency === 'LBP') && ` (inc. LBP @ ${lbpRate.toLocaleString()})`}
          </span>
          <div className="text-3xl font-black tabular-nums tracking-tight">
            {currencyCode === 'USD' || currencyCode === 'AUD' ? '$' : ''}
            {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
