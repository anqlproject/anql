import { Download, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { LogLevel, logStorage } from '@/core/logger';

import { SettingsItem, SettingsTab } from '../SettingsComponents/index';

export default function LogsTab() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const storedLogs = await logStorage.getLogs();
      setLogs(storedLogs);
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  };

  const handleExport = async () => {
    try {
      const logsContent = await logStorage.exportLogs();
      const blob = new Blob([logsContent], { type: 'application/jsonl' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-${new Date().toISOString()}.jsonl`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  const handleClear = async () => {
    if (window.confirm(t('SETTINGS.logs.confirmClear') as string)) {
      try {
        await logStorage.clearLogs();
        setLogs([]);
      } catch (error) {
        console.error('Failed to clear logs:', error);
      }
    }
  };

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => log.level === filter);

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case LogLevel.ERROR: return 'text-red-500';
      case LogLevel.WARN: return 'text-yellow-500';
      case LogLevel.INFO: return 'text-blue-500';
      case LogLevel.DEBUG: return 'text-gray-500';
    }
  };

  return (
    <SettingsTab title={t('SETTINGS.logsTab')}>
      <SettingsItem
        label={t('SETTINGS.logs.levelFilter') as string}
        description={t('SETTINGS.logs.levelFilterDescription') as string}
      >
        <select
          className="settings-input"
          value={filter}
          onChange={(e) => setFilter(e.target.value as LogLevel | 'all')}
          style={{ maxWidth: '200px' }}
        >
          <option value="all">{t('SETTINGS.logs.allLevels')}</option>
          <option value={LogLevel.ERROR}>{t('SETTINGS.logs.errorOnly')}</option>
          <option value={LogLevel.WARN}>{t('SETTINGS.logs.warnOnly')}</option>
          <option value={LogLevel.INFO}>{t('SETTINGS.logs.infoOnly')}</option>
          <option value={LogLevel.DEBUG}>{t('SETTINGS.logs.debugOnly')}</option>
        </select>
      </SettingsItem>

      <SettingsItem
        label={t('SETTINGS.logs.actions') as string}
        description={t('SETTINGS.logs.actionsDescription') as string}
      >
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExport} className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            {t('SETTINGS.logs.export')}
          </Button>
          <Button variant="destructive" onClick={handleClear} className="flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            {t('SETTINGS.logs.clear')}
          </Button>
        </div>
      </SettingsItem>

      <SettingsItem
        label={t('SETTINGS.logs.count') as string}
        description={t('SETTINGS.logs.countDescription') as string}
      >
        <div className="text-sm text-gray-600">
          {t('SETTINGS.logs.total')}: {logs.length} | {t('SETTINGS.logs.filtered')}: {filteredLogs.length}
        </div>
      </SettingsItem>

      {filteredLogs.length > 0 && (
        <div className="mt-4 border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
          <div className="space-y-2">
            {filteredLogs.slice(-50).reverse().map((log, index) => (
              <div key={index} className="text-xs font-mono border-b pb-2 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={getLevelColor(log.level)}>[{log.level.toUpperCase()}]</span>
                  <span className="text-gray-500">{log.timestamp}</span>
                </div>
                <div className="mt-1">{log.message}</div>
                {log.context && (
                  <div className="mt-1 text-gray-600">
                    {JSON.stringify(log.context, null, 2)}
                  </div>
                )}
                {log.error && (
                  <div className="mt-1 text-red-600">
                    {log.error.message}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </SettingsTab>
  );
}
