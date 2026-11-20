import { STAGES, type Stage } from '@/lib/workflow';

const STAGE_STYLE: Record<string, { cls: string; icon: string }> = {
  submitted:           { cls: 'bg-leaf-50 text-leaf-800 border-leaf-200',       icon: '📝' },
  executive_accepted:  { cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: '🔍' },
  manager_reviewed:    { cls: 'bg-purple-50 text-purple-700 border-purple-200', icon: '🏛️' },
  sr_manager_approved: { cls: 'bg-amber-50 text-amber-700 border-amber-200',    icon: '✍️' },
  ceo_approved:        { cls: 'bg-green-50 text-green-700 border-green-200',    icon: '🏆' },
  rejected:            { cls: 'bg-red-50 text-red-700 border-red-200',          icon: '❌' },
  returned:            { cls: 'bg-orange-50 text-orange-700 border-orange-200', icon: '✏️' },
};

export default function StageBadge({ stage, fastTracked }: { stage: string; fastTracked?: boolean }) {
  const s = STAGE_STYLE[stage] ?? { cls: 'bg-gray-100 text-gray-600 border-gray-200', icon: '•' };
  const label = STAGES[stage as Stage]?.label ?? stage;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-mono font-medium ${s.cls}`}>
      {s.icon} {label}
      {fastTracked && stage === 'ceo_approved' && <span className="ml-0.5 text-amber-500">⚡</span>}
    </span>
  );
}
