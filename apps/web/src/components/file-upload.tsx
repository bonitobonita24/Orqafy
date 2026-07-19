"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { prepareUploadFile, prepareThumbnail } from "@/lib/upload";

type EntityType = "customer" | "project" | "job_order" | "task" | "expense" | "invoice" | "employee" | "purchase_order" | "goods_receipt";

interface Props {
  entityType: EntityType;
  entityId: string;
  onUploadComplete?: () => void;
  maxFileSizeMb?: number;
}

interface UploadState {
  file: File;
  status: "pending" | "compressing" | "uploading" | "done" | "error";
  error?: string;
  originalSize?: number;
  compressedSize?: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({ entityType, entityId, onUploadComplete, maxFileSizeMb = 10 }: Props) {
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadsRef = useRef<UploadState[]>([]);
  uploadsRef.current = uploads;
  const utils = trpc.useUtils();

  const uploadDirect = trpc.storage.uploadDirect.useMutation();
  const uploadThumbnail = trpc.storage.uploadThumbnail.useMutation();

  const processFile = useCallback(
    async (file: File, idx: number) => {
      const updateUpload = (patch: Partial<UploadState>) =>
        setUploads((prev) => prev.map((u, i) => (i === idx ? { ...u, ...patch } : u)));

      try {
        updateUpload({ status: "compressing" });

        const prepared = await prepareUploadFile(file, maxFileSizeMb);

        if (!prepared.ok) {
          updateUpload({
            status: "error",
            error: prepared.error,
            originalSize: prepared.originalSize,
            compressedSize: prepared.compressedSize,
          });
          return;
        }

        updateUpload({
          status: "uploading",
          originalSize: prepared.originalSize,
          compressedSize: prepared.compressedSize,
        });

        const uploaded = await uploadDirect.mutateAsync({
          filename: prepared.filename,
          contentType: prepared.contentType,
          entityType,
          entityId,
          bodyBase64: prepared.bodyBase64,
        });

        // Best-effort thumbnail — generated from the ORIGINAL file (not the
        // already-compressed upload body). Failure here is NON-FATAL: the
        // main image already uploaded successfully above; the attachment
        // list simply falls back to the full-size image when thumbnailKey
        // stays null.
        try {
          const thumbnail = await prepareThumbnail(file);
          if (thumbnail) {
            await uploadThumbnail.mutateAsync({
              filename: thumbnail.filename,
              contentType: thumbnail.contentType,
              entityType,
              entityId,
              parentAttachmentId: uploaded.id,
              bodyBase64: thumbnail.bodyBase64,
            });
          }
        } catch (thumbErr) {
          // Swallow — log for diagnostics only, never surface to the user.
          console.warn("Thumbnail generation/upload failed (non-fatal):", thumbErr);
        }

        updateUpload({ status: "done" });
        await utils.storage.list.invalidate({ entityType, entityId });
        onUploadComplete?.();

        setTimeout(() => {
          setUploads((prev) => prev.filter((_, i) => i !== idx));
        }, 3000);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        updateUpload({ status: "error", error: msg });
      }
    },
    [entityType, entityId, maxFileSizeMb, uploadDirect, utils, onUploadComplete],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const newFiles = Array.from(files);
      const startIdx = uploadsRef.current.length;
      const newEntries: UploadState[] = newFiles.map((file) => ({
        file,
        status: "pending",
      }));
      setUploads((prev) => [...prev, ...newEntries]);
      newFiles.forEach((file, i) => {
        void processFile(file, startIdx + i);
      });
    },
    [processFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  return (
    <div className="space-y-3">
      <div
        className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Drag &amp; drop files here, or{" "}
          <span className="text-primary font-medium">browse</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">Max {maxFileSizeMb} MB per file</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {uploads.map((u, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-card p-3 flex items-center gap-3"
        >
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{u.file.name}</p>
            {u.status === "error" ? (
              <p className="text-xs text-destructive">{u.error}</p>
            ) : u.status === "done" ? (
              <p className="text-xs text-primary">Uploaded</p>
            ) : u.status === "compressing" ? (
              <p className="text-xs text-muted-foreground">Compressing…</p>
            ) : (
              <p className="text-xs text-muted-foreground">Uploading…</p>
            )}
            {u.originalSize !== undefined &&
              u.compressedSize !== undefined &&
              u.compressedSize < u.originalSize && (
                <p className="text-xs text-muted-foreground">
                  {formatBytes(u.originalSize)} → {formatBytes(u.compressedSize)}
                </p>
              )}
          </div>
          {(u.status === "compressing" || u.status === "uploading") && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          )}
          {(u.status === "error" || u.status === "done") && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => setUploads((prev) => prev.filter((_, j) => j !== i))}
              aria-label={`Remove ${u.file.name}`}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
