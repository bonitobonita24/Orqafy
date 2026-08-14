import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";

/**
 * Product detail spec table — adapted from the Shopix "Key Highlights"
 * idiom (starter/shopix/src/views/pages/product/product-highlights.tsx),
 * simplified to a generic label/value list matching the real
 * `Product.ecommerceSpecs` shape instead of the Shopix demo's fixed
 * category/manufacture/material/compatibility/features columns.
 */
export interface ProductSpec {
  label: string;
  value: string;
}

export interface ProductSpecsTableProps {
  specs: ProductSpec[];
}

export function ProductSpecsTable({
  specs,
}: ProductSpecsTableProps): React.ReactNode {
  if (specs.length === 0) return null;

  return (
    <section data-fdl="product-specs" className="space-y-3">
      <h2 className="text-lg font-semibold">Specifications</h2>
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableBody>
            {specs.map((spec, index) => (
              <TableRow key={spec.label + String(index)}>
                <TableCell className="w-1/3 bg-muted/50 font-medium text-muted-foreground">
                  {spec.label}
                </TableCell>
                <TableCell>{spec.value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
