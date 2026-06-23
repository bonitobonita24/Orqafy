"use client";

import { Download, Trash2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/file-upload";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type EntityType = "customer" | "project" | "job_order" | "task" | "expense" | "invoice" | "employee" | "purchase_order" | "goods_receipt";

interface Props {
  entityType: EntityType;
  entityId: string;
  readOnly?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Mirrors the Zod v1 `.cuid()` predicate used by `storage.list` on the server.
 * CUID v1: starts with 'c', followed by ≥8 non-whitespace, non-hyphen chars.
 * Demo-seed IDs (e.g. "b1iwa3dc…") don't start with 'c' and correctly fail here,
 * so we skip the query rather than fire a guaranteed-BAD_REQUEST that retries 4×.
 */
const CUID_V1_RE = /^c[^\s-]{8,}$/i;
function isValidCuid(id: string): boolean {
  return CUID_V1_RE.test(id);
}

export function AttachmentsPanel({ entityType, entityId, readOnly = false }: Props) {
  const utils = trpc.useUtils();
  const isCuid = isValidCuid(entityId);
  const { data: attachments, isLoading } = trpc.storage.list.useQuery(
    { entityType, entityId },
    {
      enabled: isCuid,
      // Do not retry on 4xx — an invalid entityId will always fail with BAD_REQUEST.
      retry: (failureCount, error) => {
        const code = (error as { data?: { httpStatus?: number } }).data?.httpStatus;
        if (code !== undefined && code >= 400 && code < 500) return false;
        return failureCount < 3;
      },
    },
  );
  const deleteAttachment = trpc.storage.delete.useMutation({
    onSuccess: async () => {
      await utils.storage.list.invalidate({ entityType, entityId });
      await utils.storage.quotaInfo.invalidate();
      toast.success("Attachment deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleDownload = async (attachmentId: string, filename: string) => {
    try {
      const result = await utils.storage.getDownloadUrl.fetch({ attachmentId });
      const a = document.createElement("a");
      a.href = result.url;
      a.download = filename;
      a.click();
    } catch {
      toast.error("Failed to get download link");
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Attachments</h3>

      {!readOnly && (
        <FileUpload
          entityType={entityType}
          entityId={entityId}
          onUploadComplete={() => {
            void utils.storage.quotaInfo.invalidate();
          }}
        />
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading attachments…
        </div>
      ) : attachments && attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(Number(a.sizeBytes))} ·{" "}
                  {a.uploadedBy.displayName ??
                    `${a.uploadedBy.firstName} ${a.uploadedBy.lastName}`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => void handleDownload(a.id, a.filename)}
                title="Download"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => deleteAttachment.mutate({ attachmentId: a.id })}
                  disabled={deleteAttachment.isPending}
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No attachments yet.</p>
      )}
    </div>
  );
}
