

interface Props {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (p: number) => void;
  onPerPageChange?: (pp: number) => void;
}

export default function Pagination({ page, perPage, total, onPageChange, onPerPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / perPage));
  const start = Math.max(1, page - 3);
  const end = Math.min(totalPages, page + 3);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-between mt-4">
      <div className="text-sm text-gray-600">
        Showing {Math.min((page - 1) * perPage + 1, total || 0)} - {Math.min(page * perPage, total || 0)} of {total}
      </div>

      <div className="flex items-center gap-2">
        {onPerPageChange && (
          <select value={perPage} onChange={(e) => { onPerPageChange(Number(e.target.value)); onPageChange(1); }} className="px-3 py-1 border rounded">
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        )}

        <div className="flex items-center gap-1">
          <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>

          {pages.map(p => (
            <button key={p} onClick={() => onPageChange(p)} className={`px-3 py-1 border rounded ${p === page ? 'bg-blue-600 text-white' : ''}`}>{p}</button>
          ))}

          <button disabled={(page * perPage) >= (total || 0)} onClick={() => onPageChange(page + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>
  );
}
