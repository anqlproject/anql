import "./TrashPanel.css";

import { motion, useReducedMotion } from "framer-motion";
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
import {
  isReferenceInTrash,
  ReferenceJson,
} from "@/core/database/useReferenceDatabase";
import { DIMENSIONS } from "@/core/global/defaultValues";
import { useReferenceStore } from "@/core/references/useReferenceStore";

type TrashItem =
  | {
      kind: "document";
      id: string;
      title: string;
      created_at: number;
      updated_at: number;
      document: DocumentsJson;
    }
  | {
      kind: "reference";
      id: string;
      title: string;
      created_at: number;
      updated_at: number;
      reference: ReferenceJson;
    };

type TrashFilter = "all" | TrashItem["kind"];

interface TrashPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TrashPanel({ isOpen, onClose }: TrashPanelProps) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [trashDocuments, setTrashDocuments] = useState<DocumentsJson[]>([]);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filter, setFilter] = useState<TrashFilter>("all");
  const references = useReferenceStore((state) => state.references);
  const loadReferences = useReferenceStore((state) => state.loadReferences);
  const restoreReference = useReferenceStore((state) => state.restoreReference);
  const removeReference = useReferenceStore((state) => state.removeReference);
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

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchTrashItems = async () => {
      try {
        const [documents] = await Promise.all([
          getDocumentsByPath("trash/"),
          loadReferences(),
        ]);
        if (isMounted) {
          setTrashDocuments(documents.sort((a, b) => b.updated_at - a.updated_at));
        }
      } catch (error) {
        console.error("Error fetching trash items:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    setLoading(true);
    fetchTrashItems();
    return () => {
      isMounted = false;
    };
  }, [isOpen, loadReferences]);

  const trashReferenceItems: TrashItem[] = references
    .filter((reference) => reference.id && isReferenceInTrash(reference))
    .map((reference) => ({
      kind: "reference",
      id: reference.id as string,
      title: `@${reference.name}`,
      created_at: reference.created_at,
      updated_at: reference.updated_at,
      reference,
    }));
  const trashItems: TrashItem[] = [
    ...trashDocuments.map((document) => ({
      kind: "document" as const,
      id: document.id,
      title: document.title,
      created_at: document.created_at,
      updated_at: document.updated_at,
      document,
    })),
    ...trashReferenceItems,
  ].sort((a, b) => b.updated_at - a.updated_at);
  const filteredTrashItems = trashItems.filter(
    (item) => filter === "all" || item.kind === filter,
  );
  const filterOptions: { value: TrashFilter; label: string; count: number }[] = [
    { value: "all", label: t("TRASH.filterAll"), count: trashItems.length },
    {
      value: "document",
      label: t("TRASH.filterDocuments"),
      count: trashDocuments.length,
    },
    {
      value: "reference",
      label: t("TRASH.filterReferences"),
      count: trashReferenceItems.length,
    },
  ];

  const handleRestore = async (item: TrashItem) => {
    const itemKey = `${item.kind}:${item.id}`;
    setRestoring(itemKey);
    try {
      if (item.kind === "reference") {
        await restoreReference(item.id);
      } else {
        const originalPath = item.document.title.includes("/")
          ? item.document.title.substring(0, item.document.title.lastIndexOf("/")) + "/"
          : "home/";
        const restoredItem: DocumentsJson = {
          ...item.document,
          path: originalPath,
          updated_at: Date.now(),
        };
        const success = await updateDocument(restoredItem);
        if (!success) throw new Error(`Failed to restore document: ${item.id}`);
        setTrashDocuments((prev) => prev.filter((document) => document.id !== item.id));
      }
    } catch (error) {
      console.error("Error restoring item:", error);
    } finally {
      setRestoring(null);
    }
  };

  const handlePermanentDelete = async (item: TrashItem) => {
    setConfirmDialog({
      isOpen: true,
      title: t("DIALOG.deleteTitle") as string,
      message: t("TRASH.confirmDelete", { title: item.title }) as string,
      onConfirm: async () => {
        const itemKey = `${item.kind}:${item.id}`;
        setDeleting(itemKey);
        try {
          if (item.kind === "reference") {
            await removeReference(item.id);
          } else {
            const success = await deleteDocument(item.id);
            if (!success) throw new Error(`Failed to delete document: ${item.id}`);
            setTrashDocuments((prev) => prev.filter((document) => document.id !== item.id));
          }
          console.log(`Item permanently deleted: ${item.title}`);
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
        for (const item of trashItems) {
          try {
            if (item.kind === "reference") {
              await removeReference(item.id);
            } else {
              const success = await deleteDocument(item.id);
              if (!success) throw new Error(`Failed to delete document: ${item.id}`);
              setTrashDocuments((prev) => prev.filter((document) => document.id !== item.id));
            }
          } catch (error) {
            console.error(`Error permanently deleting trash item ${item.id}:`, error);
          }
        }
        console.log("Trash emptied");
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
        <div className="trash-overlay-header trash-overlay-header--with-filter">
          <div className="trash-overlay-header-main">
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
          <div className="trash-filter" role="tablist" aria-label={t("TRASH.filterLabel") as string}>
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={filter === option.value}
                className={`trash-filter-button${filter === option.value ? " is-active" : ""}`}
                onClick={() => setFilter(option.value)}
              >
                {filter === option.value && (
                  <motion.span
                    aria-hidden="true"
                    className="trash-filter-indicator"
                    layoutId="trash-filter-tab-indicator"
                    transition={prefersReducedMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 500, damping: 36 }}
                  />
                )}
                <span className="trash-filter-button-content">
                  {option.label}
                  <span className="trash-filter-count">{option.count}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid">
          {filteredTrashItems.length === 0 ? (
            <div className="trash-filter-empty">
              {trashItems.length === 0
                ? t("TRASH.empty")
                : t("TRASH.noFilteredItems")}
            </div>
          ) : filteredTrashItems.map((item) => (
            <Card key={`${item.kind}:${item.id}`} className="card trashCard">
              <CardHeader className="cardHeader">
                <CardTitle className="cardTitle">
                  {item.kind === "reference"
                    ? (
                      <svg
                        className="cardIcon referenceIcon"
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="7" r="4" />
                        <circle cx="4" cy="19" r="2" />
                        <circle cx="12" cy="19" r="2" />
                        <circle cx="20" cy="19" r="2" />
                        <path d="M8 7a4 4 0 0 0-4 4v6" />
                        <path d="M12 11v6" />
                        <path d="M16 7a4 4 0 0 1 4 4v6" />
                      </svg>
                    )
                    : <Trash2 className="cardIcon trashIcon" />}
                  {item.title || t("SIDEBAR.untitled")}
                </CardTitle>
                <CardDescription className="cardDescription">
                  <div className="trashInfo">
                    <div className="fileDate">
                      {t("TRASH.deletedOn")} {formatDate(item.updated_at)}
                    </div>
                    {item.kind === "reference" && (
                      <div className="originalDate">
                        {t(`REFERENCE_PANEL.types.${item.reference.ref_type}`)}
                      </div>
                    )}
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
                    disabled={restoring === `${item.kind}:${item.id}`}
                    title={t("FEEDBACK.restore") as string}
                  >
                    <RotateCcw size={15} />
                  </button>
                  <button
                    className="trash-action-btn trash-delete-btn"
                    onClick={() => handlePermanentDelete(item)}
                    disabled={deleting === `${item.kind}:${item.id}`}
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
