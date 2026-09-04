import { useCallback, useEffect, useRef, useState } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { Download, Rocket, Loader2, CheckCircle, RefreshCw } from 'lucide-react';
import { useGlobalToast } from '@/App/hooks/useGlobalToast';

// ─── Inner toast UI ──────────────────────────────────────────────────────────

function UpdateToastContent({
  update,
  onDismiss,
}: {
  update: Update;
  onDismiss: () => void;
}) {
  const [isInstalling, setIsInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [contentLength, setContentLength] = useState(0);
  const [downloaded, setDownloaded] = useState(0);

  const handleInstall = async () => {
    try {
      setIsInstalling(true);
      setInstallError(null);
      setDownloaded(0);

      let downloadedBytes = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            setContentLength(event.data.contentLength ?? 0);
            break;
          case 'Progress':
            downloadedBytes += event.data.chunkLength;
            setDownloaded(downloadedBytes);
            break;
        }
      });

      setInstallSuccess(true);

      // Tauri restarts automatically after install.
      // We schedule a manual relaunch as a safety net after 3 s.
      setTimeout(async () => {
        try {
          await relaunch();
        } catch {
          // relaunch failed — user will see the "Restart" button below
        }
      }, 3000);

    } catch (err: any) {
      console.error('Failed to install update:', err);
      setInstallError(err.toString());
    } finally {
      setIsInstalling(false);
    }
  };

  const progressPercentage =
    contentLength > 0
      ? Math.min(100, Math.round((downloaded / contentLength) * 100))
      : 0;

  return (
    <div className="flex flex-col gap-2 min-w-[250px] py-1">
      {/* Title */}
      <div className="flex items-center gap-2">
        <Rocket size={16} className="text-blue-500" />
        <span className="font-semibold">Update {update.version} Available</span>
      </div>

      {/* States */}
      {isInstalling ? (
        <div className="flex flex-col gap-1 mt-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin text-blue-500" />
            Downloading… {progressPercentage}%
          </div>
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-200"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      ) : installSuccess ? (
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex items-center gap-2 text-green-500 text-xs">
            <CheckCircle size={14} />
            <span>Installed! Restarting…</span>
          </div>
          {/* Safety-net restart button in case auto-relaunch fails */}
          <button
            className="flex items-center justify-center gap-1 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
            onClick={() => relaunch().catch(console.error)}
          >
            <RefreshCw size={12} />
            Restart now
          </button>
        </div>
      ) : installError ? (
        <div className="flex flex-col gap-2 mt-1">
          <div className="text-red-400 text-xs">Install failed — {installError}</div>
          <button
            className="py-1.5 text-xs font-medium bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded transition-colors border border-red-500/30"
            onClick={handleInstall}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="flex gap-2 mt-2">
          <button
            className="flex-1 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 rounded transition-colors text-foreground border border-white/10"
            onClick={onDismiss}
          >
            Skip
          </button>
          <button
            className="flex-1 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors flex items-center justify-center gap-1 border border-blue-500"
            onClick={handleInstall}
          >
            <Download size={12} />
            Install
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export default function UpdateDialog() {
  const { showToast, dismissToast } = useGlobalToast();

  // Track which version we already showed a toast for (persists across intervals)
  const shownVersionRef = useRef<string | null>(null);
  // Track the active toast ID so we never stack
  const activeToastIdRef = useRef<string | null>(null);
  // Track if user clicked Skip for this version (reset on next version)
  const skippedVersionRef = useRef<string | null>(null);
  // Track if we already showed an error toast (avoid spam every 24h)
  const errorShownRef = useRef(false);

  const showUpdateToast = useCallback(
    (update: Update) => {
      // Already showing a toast for this version — do nothing
      if (activeToastIdRef.current) return;
      // User skipped this version — respect their choice
      if (skippedVersionRef.current === update.version) return;

      const handleDismiss = () => {
        skippedVersionRef.current = update.version;
        if (activeToastIdRef.current) {
          dismissToast(activeToastIdRef.current);
          activeToastIdRef.current = null;
        }
      };

      const id = showToast(
        <UpdateToastContent update={update} onDismiss={handleDismiss} />,
        'info',
        0,
        true,
      );
      activeToastIdRef.current = id;
    },
    [showToast, dismissToast],
  );

  useEffect(() => {
    let mounted = true;

    const checkForUpdate = async () => {
      try {
        const result = await check();
        if (!mounted || !result) return;

        // New version detected → reset skip/error state if version changed
        if (shownVersionRef.current !== result.version) {
          shownVersionRef.current = result.version;
          errorShownRef.current = false;
          // Dismiss any stale toast from a previous version
          if (activeToastIdRef.current) {
            dismissToast(activeToastIdRef.current);
            activeToastIdRef.current = null;
          }
        }

        showUpdateToast(result);
      } catch (err: any) {
        // Silent fail — log only. Avoids spurious toasts when no release exists yet.
        console.error('[Updater] check failed:', err);
      }
    };

    checkForUpdate();
    const interval = setInterval(checkForUpdate, 1000 * 60 * 60 * 24);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [showUpdateToast, showToast, dismissToast]);

  return null;
}
