"use client";

import {
  Document,
  Page,
  PDFViewer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

export interface QuotationPdfData {
  quotationNumber: string;
  title: string;
  status: string;
  customerName: string;
  creatorName: string;
  createdAt: string;
  validUntil: string | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  notes: string | null;
  termsAndConditions: string | null;
  markupColumns: Array<{
    id: string;
    name: string;
    percentage: number;
  }>;
  sections: Array<{
    id: string;
    name: string;
    description: string | null;
    lineItems: Array<{
      id: string;
      description: string;
      unit: string;
      quantity: number;
      baseCost: number;
      markups: Array<{
        markupColumnId: string;
        markedUpPrice: number;
      }>;
    }>;
  }>;
}

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  brand: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 1,
  },
  quotationNumber: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
  },
  metaRight: {
    textAlign: "right",
    fontSize: 9,
    color: "#374151",
  },
  metaLabel: {
    color: "#9ca3af",
  },
  metaValue: {
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 4,
  },
  customerLine: {
    fontSize: 10,
    color: "#374151",
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 12,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  sectionDesc: {
    fontSize: 9,
    color: "#6b7280",
    marginBottom: 4,
  },
  table: {
    flexDirection: "column",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  cellDesc: {
    flex: 3,
    paddingRight: 4,
  },
  cellQty: {
    flex: 0.7,
    textAlign: "right",
  },
  cellUnit: {
    flex: 0.6,
    textAlign: "center",
    color: "#6b7280",
    fontSize: 9,
  },
  cellPrice: {
    flex: 1.1,
    textAlign: "right",
  },
  cellHeader: {
    fontSize: 9,
    fontWeight: 700,
    color: "#6b7280",
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#9ca3af",
  },
  totals: {
    marginTop: 18,
    marginLeft: "auto",
    width: 200,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalLabel: {
    color: "#6b7280",
  },
  totalGrand: {
    fontWeight: 700,
    fontSize: 12,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#111",
  },
  notes: {
    marginTop: 20,
    fontSize: 9,
    color: "#374151",
  },
  notesLabel: {
    fontWeight: 700,
    marginBottom: 3,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 8,
    color: "#9ca3af",
    textAlign: "center",
  },
});

function formatMoney(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface QuotationPdfViewerProps {
  data: QuotationPdfData;
}

export function QuotationPdfViewer({ data }: QuotationPdfViewerProps) {
  const primaryColumn = data.markupColumns[0] ?? null;

  return (
    <PDFViewer style={{ width: "100%", height: "100%", border: "none" }}>
      <Document title={data.quotationNumber}>
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>QUOTATION</Text>
              <Text style={styles.quotationNumber}>{data.quotationNumber}</Text>
            </View>
            <View style={styles.metaRight}>
              <Text style={styles.metaValue}>
                <Text style={styles.metaLabel}>Issued: </Text>
                {formatDate(data.createdAt)}
              </Text>
              {data.validUntil !== null && (
                <Text style={styles.metaValue}>
                  <Text style={styles.metaLabel}>Valid until: </Text>
                  {formatDate(data.validUntil)}
                </Text>
              )}
              <Text style={styles.metaValue}>
                <Text style={styles.metaLabel}>Status: </Text>
                {data.status.toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.customerLine}>
            For: {data.customerName} · Prepared by: {data.creatorName}
            {primaryColumn !== null
              ? ` · Pricing tier: ${primaryColumn.name} (${primaryColumn.percentage}%)`
              : ""}
          </Text>

          {data.sections.map((section) => (
            <View key={section.id} wrap={false}>
              <Text style={styles.sectionHeader}>{section.name}</Text>
              {section.description !== null &&
                section.description.length > 0 && (
                  <Text style={styles.sectionDesc}>{section.description}</Text>
                )}
              <View style={styles.table}>
                <View style={[styles.row, styles.cellHeader]}>
                  <Text style={styles.cellDesc}>Description</Text>
                  <Text style={styles.cellQty}>Qty</Text>
                  <Text style={styles.cellUnit}>Unit</Text>
                  <Text style={styles.cellPrice}>Unit Price</Text>
                  <Text style={styles.cellPrice}>Line Total</Text>
                </View>
                {section.lineItems.map((li) => {
                  const markup =
                    primaryColumn !== null
                      ? li.markups.find(
                          (m) => m.markupColumnId === primaryColumn.id,
                        )
                      : undefined;
                  const unitPrice =
                    markup !== undefined ? markup.markedUpPrice : li.baseCost;
                  const lineTotal = li.quantity * unitPrice;
                  return (
                    <View key={li.id} style={styles.row}>
                      <Text style={styles.cellDesc}>{li.description}</Text>
                      <Text style={styles.cellQty}>{li.quantity}</Text>
                      <Text style={styles.cellUnit}>{li.unit}</Text>
                      <Text style={styles.cellPrice}>
                        {formatMoney(unitPrice, data.currency)}
                      </Text>
                      <Text style={styles.cellPrice}>
                        {formatMoney(lineTotal, data.currency)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}

          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text>{formatMoney(data.subtotal, data.currency)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax</Text>
              <Text>{formatMoney(data.taxAmount, data.currency)}</Text>
            </View>
            <View style={[styles.totalRow, styles.totalGrand]}>
              <Text>Total</Text>
              <Text>{formatMoney(data.totalAmount, data.currency)}</Text>
            </View>
          </View>

          {data.notes !== null && data.notes.length > 0 && (
            <View style={styles.notes}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text>{data.notes}</Text>
            </View>
          )}

          {data.termsAndConditions !== null &&
            data.termsAndConditions.length > 0 && (
              <View style={styles.notes}>
                <Text style={styles.notesLabel}>Terms & Conditions</Text>
                <Text>{data.termsAndConditions}</Text>
              </View>
            )}

          <Text
            style={styles.footer}
            render={({ pageNumber, totalPages }) =>
              `${data.quotationNumber} · Page ${pageNumber} of ${totalPages}`
            }
            fixed
          />
        </Page>
      </Document>
    </PDFViewer>
  );
}
