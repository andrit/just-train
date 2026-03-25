// ------------------------------------------------------------
// components/dashboard/widgets/GoalsWidget.tsx
//
// Shows active (unachieved) goal count.
// Phase 7: will show progress toward goals.
// For now shows count + a placeholder spark.
// ------------------------------------------------------------


interface GoalsWidgetProps {
  /** Total active (unachieved) goals across all clients */
  activeGoalCount:   number
  /** Goals achieved this month */
  achievedThisMonth: number
}

export function GoalsWidget({
  activeGoalCount,
  achievedThisMonth,
}: GoalsWidgetProps): React.JSX.Element {
  return (
    <div className="card p-4">
      <p className="section-label">Goals</p>

      <div className="flex items-end justify-between">
        <div>
          <span className="font-display text-5xl text-white leading-none">
            {activeGoalCount}
          </span>
          <p className="text-xs text-gray-500 mt-1">active</p>
        </div>

        {achievedThisMonth > 0 && (
          <div className="text-right">
            <span className="font-display text-2xl text-emerald-400 leading-none">
              {achievedThisMonth}
            </span>
            <p className="text-xs text-emerald-600 mt-1">achieved this month</p>
          </div>
        )}
      </div>

      {activeGoalCount === 0 && (
        <p className="text-xs text-gray-600 mt-3">
          No active goals — add goals from client profiles.
        </p>
      )}
    </div>
  )
}
