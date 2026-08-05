import './ProgressBar.css';

export interface ProgressBarProps {
  /**
   * Current value of the progression
   */
  current: number;
  /**
   * Final/total expected value
   */
  total: number;
  /**
   * Additional CSS classes for versatility
   */
  className?: string;
}

export function ProgressBar({
  current,
  total,
  className = ''
}: ProgressBarProps) {
  // Safe percentage calculation between 0 and 100
  const percentage = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;

  return (
    <div className={`progress-bar-container ${className}`}>
      {/* Progress bar */}
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Footer: Percentage only */}
      <div className="progress-bar-footer">
        <span className="progress-bar-percentage">
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  );
}
