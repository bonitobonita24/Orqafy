"use client";
import { AttachmentsPanel } from "@/components/attachments-panel";

interface Props {
  goodsReceiptId: string;
}

export function GoodsReceiptAttachments({ goodsReceiptId }: Props) {
  return <AttachmentsPanel entityType="goods_receipt" entityId={goodsReceiptId} />;
}
