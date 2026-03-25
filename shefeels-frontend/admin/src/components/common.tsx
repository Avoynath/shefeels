import React from 'react';

interface TableProps {
  headers: string[];
  data: any[];
  renderRow: (item: any, index: number) => React.ReactNode;
  loading?: boolean;
  emptyMessage?: string;
}

export function Table({ headers, data, renderRow, loading, emptyMessage = 'No data found' }: TableProps) {
  if (loading) {
    return <div className="p-4 text-gray-500">Loading...</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left border-b bg-gray-50">
            {headers.map((h, i) => (
              <th key={i} className="py-3 px-4 font-semibold text-gray-700">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <React.Fragment key={item.id || idx}>
              {renderRow(item, idx)}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      {data.length === 0 && (
        <div className="text-gray-500 text-center py-8">{emptyMessage}</div>
      )}
    </div>
  );
}

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalItems, pageSize, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);
  
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4">
      <div className="text-sm text-gray-600">
        Showing {Math.min((currentPage - 1) * pageSize + 1, totalItems)} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Previous
        </button>
        <span className="px-3 py-1">Page {currentPage} of {totalPages}</span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchFilter({ value, onChange, placeholder = 'Search...' }: SearchFilterProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

interface ButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  type?: 'button' | 'submit';
}

export function Button({ onClick, children, variant = 'primary', disabled, type = 'button' }: ButtonProps) {
  const baseClasses = 'px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    danger: 'bg-red-600 text-white hover:bg-red-700'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]}`}
    >
      {children}
    </button>
  );
}

interface DateRangeFilterProps {
  from?: string;
  to?: string;
  onChangeFrom?: (value: string) => void;
  onChangeTo?: (value: string) => void;
}

export function DateRangeFilter({ from, to, onChangeFrom, onChangeTo }: DateRangeFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={from || ''}
        onChange={(e) => onChangeFrom?.(e.target.value)}
        className="px-3 py-2 border rounded text-sm w-36"
        aria-label="From date"
      />
      <span className="text-sm text-gray-500">→</span>
      <input
        type="date"
        value={to || ''}
        onChange={(e) => onChangeTo?.(e.target.value)}
        className="px-3 py-2 border rounded text-sm w-36"
        aria-label="To date"
      />
    </div>
  )
}
