import './BackgroundTaskIndicator.css';

import React from 'react';

import { useBackgroundTaskRunner } from '@/core/BackgroundTask/BackgroundTaskRunner';

/**
 * Barre de charge globale affichée en bas de l'écran
 * quand des tâches tournent en fond (sauvegarde, copie, etc.)
 * S'auto-détruit quand il n'y a plus rien en cours.
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
