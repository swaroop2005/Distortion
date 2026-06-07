const styles = {
  full: 'bg-emerald-100 text-emerald-800',
  'at-risk': 'bg-amber-100 text-amber-800',
  broken: 'bg-rose-100 text-rose-800',
  eligible: 'bg-emerald-100 text-emerald-800',
  ineligible: 'bg-gray-100 text-gray-600',
  urgent: 'bg-rose-100 text-rose-800',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}
