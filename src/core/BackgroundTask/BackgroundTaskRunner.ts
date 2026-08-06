import { create } from 'zustand';

export interface BackgroundTask {
  id: string;
  label: string;
  startedAt: number;
}

interface BackgroundTaskStore {
  tasks: BackgroundTask[];
  isPending: boolean;

  /**
   * Submit an async task to the runner.
   * The task is launched immediately in background and self-destructs when finished.
   * @param task   Async function to execute (isolated, context captured at call)
   * @param label  Label displayed in the progress bar (ex: "Saving document...")
   * @param onDone Optional callback called when the task finishes (success or error)
   * @returns The unique identifier of the task
   */
  run: (task: () => Promise<void>, label: string, onDone?: (error?: unknown) => void) => string;

  /**
   * Efface toutes les tâches en cours
   */
  clearAll: () => void;
}

export const useBackgroundTaskRunner = create<BackgroundTaskStore>((set) => ({
  tasks: [],
  isPending: false,

  run: (task, label, onDone) => {
    const id = crypto.randomUUID();
    const newTask: BackgroundTask = { id, label, startedAt: Date.now() };

    // Ajouter la tâche à la liste (la barre de charge s'active)
    set((state) => ({
      tasks: [...state.tasks, newTask],
      isPending: true,
    }));

    let taskError: unknown = undefined;

    // Launch the task in background — completely isolated
    task()
      .catch((error) => {
        console.error(`[BackgroundTaskRunner] Task "${label}" failed:`, error);
        taskError = error;
      })
      .finally(() => {
        onDone?.(taskError);

        // Remove the completed task (auto-destruction)
        set((state) => {
          const remaining = state.tasks.filter((t) => t.id !== id);
          return {
            tasks: remaining,
            isPending: remaining.length > 0,
          };
        });
      });

    return id;
  },

  clearAll: () => set({ tasks: [], isPending: false }),
}));
