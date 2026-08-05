import { useTranslation } from 'react-i18next';

import { Dialog } from '@/components/custom/Dialog/Dialog';
import { cleanupDatabase } from '@/core/database/useDatabase';

interface DatabaseCleanupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  unauthorizedTables: string[];
  onCleanup: () => void;
}

export function DatabaseCleanupDialog({
  isOpen,
  onClose,
  unauthorizedTables,
  onCleanup,
}: DatabaseCleanupDialogProps) {
  const { t } = useTranslation();

  const handleCleanup = async () => {
    try {
      await cleanupDatabase(unauthorizedTables);
      onCleanup();
    } catch (error) {
      console.error("Cleanup failed:", error);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('DIALOG.cleanupTitle') as string}
      description={
        <>
          {t('DIALOG.cleanupDescription')}
          <div className="mt-2 p-3 bg-gray-50 border border-gray-200 text-sm">
            <ul className="list-disc list-inside">
              {unauthorizedTables.map(table => (
                <li key={table} className="text-gray-700">{table}</li>
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
