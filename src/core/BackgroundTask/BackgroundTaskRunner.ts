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
   * Soumet une tâche async au runner.
   * La tâche est lancée immédiatement en fond et s'auto-détruit à la fin.
   * @param task   Fonction async à exécuter (isolée, contexte capturé à l'appel)
   * @param label  Label affiché dans la barre de charge (ex: "Saving document...")
   * @param onDone Callback optionnel appelé quand la tâche se termine (succès ou erreur)
   * @returns L'identifiant unique de la tâche
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

    // Lancer la tâche en fond — complètement isolée
    task()
      .catch((error) => {
        console.error(`[BackgroundTaskRunner] Task "${label}" failed:`, error);
        taskError = error;
      })
      .finally(() => {
        onDone?.(taskError);

        // Supprimer la tâche terminée (auto-destruction)
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
