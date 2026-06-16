"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

const ENTITY_TYPES = [
  "customer",
  "project",
  "job_order",
  "task",
  "expense",
  "invoice",
  "employee",
  "purchase_order",
  "goods_receipt",
] as const;
type EntityType = (typeof ENTITY_TYPES)[number];

interface Props {
  entityType: EntityType;
  entityId: string;
  onUploadComplete?: () => void;
  maxFileSizeMb?: number;
}

interface UploadState {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "confirming" | "done" | "error";
  error?: string;
}

export function FileUpload({ entityType, entityId, onUploadComplete, maxFileSizeMb = 10 }: Props) {
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadsRef = useRef<UploadState[]>([]);
  uploadsRef.current = uploads;
  const utils = trpc.useUtils();

  const getUploadUrl = trpc.storage.getUploadUrl.useMutation();
  const confirmUpload = trpc.storage.confirmUpload.useMutation();

  const processFile = useCallback(
    async (file: File, idx: number) => {
      const maxBytes = maxFileSizeMb * 1024 * 1024;
      const updateUpload = (patch: Partial<UploadState>) =>
        setUploads((prev) => prev.map((u, i) => (i === idx ? { ...u, ...patch } : u)));

      if (file.size > maxBytes) {
        updateUpload({ status: "error", error: `File exceeds ${maxFileSizeMb} MB limit` });
        return;
      }

      try {
        const { url, storageKey } = await getUploadUrl.mutateAsync({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          entityType,
          entityId,
        });

        updateUpload({ status: "uploading" });

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              updateUpload({ progress: Math.round((e.loaded / e.total) * 90) });
            }
          };
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error(`Upload failed: ${xhr.status}`));
          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.open("PUT", url);
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
          xhr.send(file);
        });

        updateUpload({ status: "confirming", progress: 95 });

        await confirmUpload.mutateAsync({
          storageKey,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          entityType,
          entityId,
        });

        updateUpload({ status: "done", progress: 100 });
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
    [entityType, entityId, maxFileSizeMb, getUploadUrl, confirmUpload, utils, onUploadComplete],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const newFiles = Array.from(files);
      const startIdx = uploadsRef.current.length;
      const newEntries: UploadState[] = newFiles.map((file) => ({
        file,
        progress: 0,
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
            ) : (
              <div className="h-1 mt-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${u.progress}%` }}
                />
              </div>
            )}
          </div>
          {(u.status === "uploading" || u.status === "confirming") && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          )}
          {(u.status === "error" || u.status === "done") && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => setUploads((prev) => prev.filter((_, j) => j !== i))}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
