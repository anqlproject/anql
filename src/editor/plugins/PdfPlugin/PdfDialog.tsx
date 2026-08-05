import './PdfDialog.css';

import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import type { JSX } from 'react';
import { useState } from 'react';

import { ComponentDialog } from '@/components/custom/ComponentDialog/ComponentDialog';
import { createAsset } from '@/core/database/useAssetDatabase';
import { logger } from '@/core/logger';

interface PdfDialogProps {
  onClose: () => void;
  onConfirm: (url: string, name: string) => void;
  initialName?: string;
}

export function PdfDialog({ onClose, onConfirm, initialName = '' }: PdfDialogProps): JSX.Element {
  const [fileName, setFileName] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [name, setName] = useState(initialName);
  const [isUploading, setIsUploading] = useState(false);

  const handleChooseFile = async () => {
    try {
      const selectedPath = await open({
        multiple: false,
        directory: false,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });

      if (!selectedPath || typeof selectedPath !== 'string') return;

      const parts = selectedPath.split(/[/\\]/);
      const selected = parts[parts.length - 1];
      setFilePath(selectedPath);
      setFileName(selected);
      if (!name) setName(selected.replace(/\.pdf$/i, ''));
    } catch (err) {
      logger.error('Failed to open file dialog', err as Error);
    }
  };

  const handleConfirm = async () => {
    if (!filePath || !fileName) return;

    try {
      setIsUploading(true);

      const bytes = await readFile(filePath);

      // Convert bytes to base64 string — Rust will decode it
      let binary = '';
      const len = bytes.length;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);

      const id = crypto.randomUUID();
      await createAsset(id, name || fileName, 'application/pdf', base64Data);

      const assetRef = `asset://${id}`;
      onConfirm(assetRef, name || fileName);
    } catch (err) {
      logger.error('Failed to upload PDF asset', err as Error);
    } finally {
      setIsUploading(false);
      onClose();
    }
  };

  return (
    <ComponentDialog
      title="Insert PDF"
      onClose={onClose}
      rightButton={{
        text: isUploading ? 'Saving…' : 'Insert',
        onClick: handleConfirm,
        disabled: !filePath || isUploading,
      }}
    >
      <div className="pdf-dialog-field">
        <label className="pdf-dialog-label">
          PDF File:
        </label>
        <div className="pdf-dialog-file-row">
          <button
            type="button"
            className="pdf-dialog-choose-btn"
            onClick={handleChooseFile}
          >
            Choose File
          </button>
          <span className={`pdf-dialog-file-name${fileName ? ' has-file' : ''}`}>
            {fileName ?? 'No file chosen'}
          </span>
        </div>
      </div>

      <div className="pdf-dialog-field">
        <label htmlFor="pdf-name" className="pdf-dialog-label">
          PDF Name:
        </label>
        <input
          id="pdf-name"
          type="text"
          className="pdf-dialog-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm();
            else if (e.key === 'Escape') onClose();
          }}
          placeholder="Document name (optional)"
        />
      </div>
    </ComponentDialog>
  );
}
