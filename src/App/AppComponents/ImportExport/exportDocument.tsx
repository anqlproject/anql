import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { Check, X } from 'lucide-react';

import { useGlobalToast } from '@/App/hooks/useGlobalToast';
import { ProgressBar } from '@/components/custom/ProgressBar/ProgressBar';
import { useBackgroundTaskRunner } from '@/core/BackgroundTask/BackgroundTaskRunner';
import { extractAssetIds } from '@/core/database/useAssetDatabase';

export function useExportDocument() {
  const run = useBackgroundTaskRunner((state) => state.run);
  const { showToast, updateToast, dismissToast } = useGlobalToast();

  const exportDocument = async (content: string, title?: string) => {
    try {
      const sanitizedTitle = title?.replace(/[^a-zA-Z0-9_-]/g, '_') || 'document';
      const defaultFilename = `${sanitizedTitle}.anql`;

      const filePath = await save({
        defaultPath: defaultFilename,
        filters: [{
          name: 'Anql Archive',
          extensions: ['anql']
        }]
      });

      if (filePath) {
        const assetIds = extractAssetIds(content);

        // Show persistent toast with progress bar and close button
        const id = showToast(
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Exporting document...</span>
              <button
                onClick={() => {
                  clearInterval(progressInterval);
                  dismissToast(id);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'inherit',
                  opacity: 0.7
                }}
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ProgressBar current={0} total={100} />
          </div>,
          'info',
          0, // No auto-dismiss
          true // Persistent
        );

        // Simulate progress during export
        let progress = 0;
        const progressInterval = setInterval(() => {
          if (progress >= 90) return;
          progress += 10;
          // Update toast with new progress
          updateToast(id, (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Exporting document...</span>
                <button
                  onClick={() => {
                    clearInterval(progressInterval);
                    dismissToast(id);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'inherit',
                    opacity: 0.7
                  }}
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ProgressBar current={progress} total={100} />
            </div>
          ));
        }, 200);

        run(
          async () => {
            await invoke('export_to_zip', {
              destinationPath: filePath,
              content: content,
              extension: 'json',
              assetIds: assetIds
            });
          },
          'Exporting document...',
          (error) => {
            clearInterval(progressInterval);

            if (error) {
              console.error('Export failed:', error);
              // Update to error state
              updateToast(id, (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#ef4444' }}>Export failed</span>
                    <button
                      onClick={() => dismissToast(id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        color: 'inherit',
                        opacity: 0.7
                      }}
                      aria-label="Fermer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <ProgressBar current={0} total={100} />
                </div>
              ), { persistent: false, duration: 3000 });
            } else {
              // Update to success state - keep progress bar, add success badge
              updateToast(id, (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: '#22c55e',
                        color: 'white'
                      }}>
                        <Check className="w-3 h-3" />
                      </div>
                      <span style={{ color: '#22c55e' }}>Document exported successfully</span>
                    </div>
                    <button
                      onClick={() => dismissToast(id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        color: 'inherit',
                        opacity: 0.7
                      }}
                      aria-label="Fermer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <ProgressBar current={100} total={100} />
                </div>
              ), { persistent: false, duration: 4000 });
            }
          }
        );
      }
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  };

  return { exportDocument };
}
