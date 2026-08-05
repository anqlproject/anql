import { useTranslation } from 'react-i18next';

import { Dialog } from '@/components/custom/Dialog/Dialog';
import { cleanupOrphanAssets } from '@/core/database/useDatabase';

interface OrphanAssetsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orphanAssets: string[];
  onCleanup: () => void;
}

export function OrphanAssetsDialog({
  isOpen,
  onClose,
  orphanAssets,
  onCleanup,
}: OrphanAssetsDialogProps) {
  const { t } = useTranslation();

  const handleCleanup = async () => {
    try {
      await cleanupOrphanAssets(orphanAssets);
      onCleanup();
    } catch (error) {
      console.error("Orphan cleanup failed:", error);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('DIALOG.cleanupOrphanTitle') || "Orphan Assets Found"}
      description={
        <>
          The following files are stored on disk but are not referenced in the database:
          <div className="mt-2 p-3 bg-gray-50 border border-gray-200 text-sm" style={{ maxHeight: '30vh', minHeight: '100px', overflowY: 'auto' }}>
            <ul className="list-disc list-inside">
              {orphanAssets.map(asset => (
                <li key={asset} className="text-gray-700">{asset}</li>
              ))}
            </ul>
          </div>
        </>
      }
      mode="request"
      leftButton={{
        text: t('DIALOG.cleanup') as string,
        onClick: handleCleanup
      }}
      rightButton={{
        text: t('DIALOG.close') as string,
        onClick: onClose
      }}
    />
  );
}
