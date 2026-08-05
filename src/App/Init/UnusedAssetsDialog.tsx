import { useTranslation } from 'react-i18next';

import { Dialog } from '@/components/custom/Dialog/Dialog';
import type { AssetJson } from '@/core/database/useAssetDatabase';
import { cleanupUnusedAssets } from '@/core/database/useAssetDatabase';

interface UnusedAssetsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  unusedAssets: AssetJson[];
  onCleanup: () => void;
}

export function UnusedAssetsDialog({
  isOpen,
  onClose,
  unusedAssets,
  onCleanup,
}: UnusedAssetsDialogProps) {
  const { t } = useTranslation();

  const handleCleanup = async () => {
    try {
      await cleanupUnusedAssets();
      onCleanup();
    } catch (error) {
      console.error("Asset cleanup failed:", error);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('DIALOG.cleanupAssetsTitle') || "Unused Assets Found"}
      description={
        <>
          The following assets are stored in the database but are not used in any document:
          <div className="mt-2 p-3 bg-gray-50 border border-gray-200 text-sm" style={{ maxHeight: '30vh', minHeight: '100px', overflowY: 'auto' }}>
            <ul className="list-disc list-inside">
              {unusedAssets.map((asset) => (
                <li key={asset.id} className="text-gray-700">{asset.name || asset.id}</li>
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
