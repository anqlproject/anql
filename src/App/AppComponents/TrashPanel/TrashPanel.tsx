import "./TrashPanel.css";

import { RotateCcw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Dialog } from "@/components/custom/Dialog/Dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  deleteDocument,
  getDocumentsByPath,
  updateDocument,
} from "@/core/database/useDocumentDatabase";
import { DocumentsJson } from "@/core/database/useDocumentDatabase";
import { DIMENSIONS } from "@/core/global/defaultValues";

interface TrashPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TrashPanel({ isOpen, onClose }: TrashPanelProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [trashItems, setTrashItems] = useState<DocumentsJson[]>([]);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const formatDate = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  }, []);

  // Fetch trash items on component mount
  useEffect(() => {
    const fetchTrashItems = async () => {
      try {
        const result = await getDocumentsByPath("trash/");
        setTrashItems(result.sort((a, b) => b.updated_at - a.updated_at)); // Sort by newest first
      } catch (error) {
        console.error("Error fetching trash items:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrashItems();
  }, []);

  const handleRestore = async (item: DocumentsJson) => {
    setRestoring(item.id);
    try {
      // Extract original path from title or use a default path
      // You might want to store the original path in the trash system
      const originalPath = item.title.includes("/")
        ? item.title.substring(0, item.title.lastIndexOf("/")) + "/"
        : "home/";

      const restoredItem: DocumentsJson = {
        ...item,
        path: originalPath,
        updated_at: Date.now(),
      };

      const success = await updateDocument(restoredItem);
      if (success) {
        // Remove from local state
        setTrashItems((prev) => prev.filter((i) => i.id !== item.id));
        console.log(`Item restored: ${item.title}`);
      }
    } catch (error) {
      console.error("Error restoring item:", error);
    } finally {
      setRestoring(null);
    }
  };

  const handlePermanentDelete = async (item: DocumentsJson) => {
    setConfirmDialog({
      isOpen: true,
      title: t("DIALOG.deleteTitle") as string,
      message: t("TRASH.confirmDelete", { title: item.title }) as string,
      onConfirm: async () => {
        setDeleting(item.id);
        try {
          const success = await deleteDocument(item.id);
          if (success) {
            setTrashItems((prev) => prev.filter((i) => i.id !== item.id));
            console.log(`Item permanently deleted: ${item.title}`);
          }
        } catch (error) {
          console.error("Error deleting item:", error);
        } finally {
          setDeleting(null);
        }
        setConfirmDialog({
          isOpen: false,
          title: "",
          message: "",
          onConfirm: () => {},
        });
      },
    });
  };

  const handleEmptyTrash = async () => {
    setConfirmDialog({
      isOpen: true,
      title: t("DIALOG.emptyTrashTitle") as string,
      message: t("TRASH.confirmEmptyTrash", {
        count: trashItems.length,
      }) as string,
      onConfirm: async () => {
        try {
          for (const item of trashItems) {
            await deleteDocument(item.id);
          }
          setTrashItems([]);
          console.log("Trash emptied");
        } catch (error) {
          console.error("Error emptying trash:", error);
        }
        setConfirmDialog({
          isOpen: false,
          title: "",
          message: "",
          onConfirm: () => {},
        });
      },
    });
  };

  if (!isOpen) {
    return null;
  }

  if (loading) {
    return (
      <div
        className="trash-overlay"
        style={{ paddingTop: DIMENSIONS.overlayTopOffset }}
      >
        <div className="trash-overlay-backdrop" onClick={onClose}></div>
        <div
          className="trash-overlay-content"
          style={{
            width: DIMENSIONS.panelWidth,
            height: DIMENSIONS.panelHeight,
          }}
        >
          <div className="trash-overlay-header">
            <h1 className="title">{t("TRASH.title")}</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="close-button"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="emptyState">
            <div className="emptyStateContent">
              <Trash2 className="emptyStateIcon" />
              <h2 className="emptyStateTitle">{t("TRASH.loading")}</h2>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (trashItems.length === 0) {
    return (
      <div
        className="trash-overlay"
        style={{
          paddingTop: DIMENSIONS.overlayTopOffset,
        }}
      >
        <div className="trash-overlay-backdrop" onClick={onClose}></div>
        <div
          className="trash-overlay-content"
          style={{
            width: DIMENSIONS.panelWidth_medium,
            height: DIMENSIONS.panelHeight_medium,
          }}
        >
          <div className="trash-overlay-header">
            <h1 className="title">Corbeille</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="close-button"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="emptyState">
            <div className="emptyStateContent">
              <Trash2 className="emptyStateIcon" />
              <h2 className="emptyStateTitle">{t("TRASH.empty")}</h2>
              <p className="emptyStateDescription">
                {t("TRASH.emptyDescription")}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="trash-overlay"
      style={{ paddingTop: DIMENSIONS.overlayTopOffset }}
    >
      <div className="trash-overlay-backdrop" onClick={onClose}></div>
      <div
        className="trash-overlay-content"
        style={{
          width: DIMENSIONS.panelWidth_medium,
          height: DIMENSIONS.panelHeight_medium
        }}
      >
        <div className="trash-overlay-header">
          <h1 className="title">
            {t("TRASH.title")} ({trashItems.length})
          </h1>
          <div className="header-actions">
            <button
              className="trash-empty-all-btn"
              onClick={handleEmptyTrash}
              disabled={trashItems.length === 0}
              title={t("TRASH.emptyTrash") as string}
            >
              <Trash2 size={13} />
              {t("TRASH.emptyTrash") as string}
            </button>
            <button
              className="close-button"
              onClick={onClose}
              title={t("TRASH.close") as string}
            >
              <X size={15} />
            </button>
          </div>
        </div>
        <div className="grid">
          {trashItems.map((item, index) => (
            <Card key={index} className="card trashCard">
              <CardHeader className="cardHeader">
                <CardTitle className="cardTitle">
                  <Trash2 className="cardIcon trashIcon" />
                  {item.title || t("SIDEBAR.untitled")}
                </CardTitle>
                <CardDescription className="cardDescription">
                  <div className="trashInfo">
                    <div className="fileDate">
                      {t("TRASH.deletedOn")} {formatDate(item.updated_at)}
                    </div>
                    {item.created_at && (
                      <div className="originalDate">
                        {t("TRASH.createdOn")} {formatDate(item.created_at)}
                      </div>
                    )}
                  </div>
                </CardDescription>
              </CardHeader>
              <div className="cardContent">
                <div className="cardActions">
                  <button
                    className="trash-action-btn trash-restore-btn"
                    onClick={() => handleRestore(item)}
                    disabled={restoring === item.id}
                    title={t("FEEDBACK.restore") as string}
                  >
                    <RotateCcw size={15} />
                  </button>
                  <button
                    className="trash-action-btn trash-delete-btn"
                    onClick={() => handlePermanentDelete(item)}
                    disabled={deleting === item.id}
                    title={t("TRASH.permanentlyDelete") as string}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Dialog
        isOpen={confirmDialog.isOpen}
        onClose={() =>
          setConfirmDialog({
            isOpen: false,
            title: "",
            message: "",
            onConfirm: () => {},
          })
        }
        title={confirmDialog.title}
        description={confirmDialog.message}
        mode="urgent"
        leftButton={{
          text: t("DIALOG.cancel") as string,
          onClick: () =>
            setConfirmDialog({
              isOpen: false,
              title: "",
              message: "",
              onConfirm: () => {},
            }),
        }}
        rightButton={{
          text: t("DIALOG.delete") as string,
          onClick: confirmDialog.onConfirm,
          variant: "danger",
        }}
      />
    </div>
  );
}
