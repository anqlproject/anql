import { useBackgroundTaskRunner } from './BackgroundTaskRunner';

// ============================================================================
// CASE 1: Basic usage in a React component (Fire and forget)
// ============================================================================
export function ExampleBasicUsage() {
  // Retrieve only the `run` action to avoid unnecessary re-renders
  const run = useBackgroundTaskRunner((state) => state.run);

  const handleSave = () => {
    run(
      async () => {
        // Simulation of a long task (e.g., API call, saving)
        await new Promise((resolve) => setTimeout(resolve, 2000));
        console.log('Save completed');
      },
      'Saving document...' // This label will be displayed in the global loading bar
    );
  };

  return <button onClick={handleSave}>Save</button>;
}

// ============================================================================
// CASE 2: Usage with success and error handling via `onDone`
// ============================================================================
export function ExampleWithCallbacks() {
  const run = useBackgroundTaskRunner((state) => state.run);

  const handleExport = () => {
    run(
      async () => {
        // Simulation of a task that fails
        const success = Math.random() > 0.5;
        if (!success) throw new Error("Unexpected network error");

        await new Promise((resolve) => setTimeout(resolve, 1000));
      },
      'Export in progress...',
      (error) => {
        if (error) {
          // Display an error notification to the user (e.g., toast.error)
          console.error("UI Notification: Export failed:", error);
        } else {
          // Display a success notification (e.g., toast.success)
          console.log("UI Notification: Export successful!");
        }
      }
    );
  };

  return <button onClick={handleExport}>Export</button>;
}

// ============================================================================
// CASE 3: Retrieving the task ID (e.g., for specific tracking)
// ============================================================================
export function ExampleWithTaskId() {
  const run = useBackgroundTaskRunner((state) => state.run);

  const handleProcess = () => {
    const taskId = run(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      },
      'Processing data...'
    );

    console.log("Task launched with unique ID:", taskId);
  };

  return <button onClick={handleProcess}>Process</button>;
}

// ============================================================================
// CASE 4: Global cleanup from a React component (clearAll)
// ============================================================================
export function ExampleClearAll() {
  const clearAll = useBackgroundTaskRunner((state) => state.clearAll);

  const handleCancelAll = () => {
    // Clears the task list and disables the isPending indicator.
    // NOTE: Ongoing JavaScript promises will continue to execute in the 
    // background until they complete, but the UI will no longer track them.
    clearAll();
  };

  return <button onClick={handleCancelAll}>Cancel All</button>;
}

// ============================================================================
// CASE 5: Usage OUTSIDE of React (API Interceptors, Routers, Utils...)
// ============================================================================
export function runTaskOutsideReact() {
  // Use getState() to access store actions without using a Hook
  const { run } = useBackgroundTaskRunner.getState();

  run(
    async () => {
      // Ex: A network interceptor triggering a token refresh
      await new Promise((resolve) => setTimeout(resolve, 1500));
    },
    'System synchronization...'
  );
}

// ============================================================================
// CASE 6: Global logout OUTSIDE of React (Using clearAll)
// ============================================================================
export function performGlobalLogout() {
  // During a logout or a fatal error, we clear the global UI state
  useBackgroundTaskRunner.getState().clearAll();

  // ... continue logout process ...
  // localStorage.removeItem('token');
  // window.location.href = '/login';
}

// ============================================================================
// CASE 7: Closures with Mutable Variables (Global or useRef)
// ============================================================================
let globalMutableValue = "Initial";

export function ExampleMutableClosure() {
  const run = useBackgroundTaskRunner((state) => state.run);

  const handleRun = () => {
    run(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        // This will log "Updated" because closures capture references to mutable variables
        console.log("Global value inside task:", globalMutableValue);
      },
      'Reading mutable variable...'
    );

    // Change the value immediately after starting the task
    globalMutableValue = "Updated";
  };

  return <button onClick={handleRun}>Run</button>;
}

// ============================================================================
// CASE 8: Closures with React State (The "Stale Closure" pitfall)
// ============================================================================
import { useRef,useState } from 'react';
export function ExampleReactStateClosure() {
  const run = useBackgroundTaskRunner((state) => state.run);
  const [count, setCount] = useState(0);
  const countRef = useRef(count);

  // Keep ref synced with state
  countRef.current = count;

  const handleRun = () => {
    run(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // PITFALL: 'count' remains the value it was when the task started (e.g., 0)
        console.log("Stale React state:", count);

        // SOLUTION: Use a ref to get the latest value at execution time
        console.log("Fresh React state via Ref:", countRef.current);
      },
      'Reading React state...'
    );

    setCount(1); // State changes while task is running
  };

  return <button onClick={handleRun}>Run</button>;
}

// ============================================================================
// CASE 9: Closures with Global Store (Zustand)
// ============================================================================
export function ExampleStoreClosure() {
  const run = useBackgroundTaskRunner((state) => state.run);

  const handleRun = () => {
    // PITFALL: Reading state before the task captures the old value
    const staleTasksCount = useBackgroundTaskRunner.getState().tasks.length;

    run(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // SOLUTION: Read the state INSIDE the async function when needed
        const freshTasksCount = useBackgroundTaskRunner.getState().tasks.length;

        console.log("Stale count:", staleTasksCount); // Might be outdated
        console.log("Fresh count:", freshTasksCount); // Always up-to-date
      },
      'Reading global store...'
    );
  };

  return <button onClick={handleRun}>Run</button>;
}
