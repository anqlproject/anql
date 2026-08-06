import './BackgroundTaskIndicator.css';

import React from 'react';

import { useBackgroundTaskRunner } from '@/core/BackgroundTask/BackgroundTaskRunner';

/**
 * Global progress bar displayed at the bottom of the screen
 * when tasks are running in background (save, copy, etc.)
 * Self-destructs when there is nothing left in progress.
 */
export function BackgroundTaskIndicator(): React.JSX.Element | null {
  const { isPending, tasks } = useBackgroundTaskRunner();

  if (!isPending) return null;

  const latestTask = tasks[tasks.length - 1];

  return (
    <div className="bg-task-bar" aria-live="polite" aria-label="Background tasks in progress">
      <div className="bg-task-bar__progress" />
      <span className="bg-task-bar__label">
        {latestTask?.label ?? 'Processing...'}
        {tasks.length > 1 && (
          <span className="bg-task-bar__count"> (+{tasks.length - 1})</span>
        )}
      </span>
    </div>
  );
}
