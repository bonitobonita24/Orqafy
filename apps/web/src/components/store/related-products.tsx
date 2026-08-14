import {
  StoreProductCard,
  type StoreProductCardProduct,
} from "@/components/store/product-card";

/**
 * "You may also like" rail — adapted from the Shopix related-products idiom
 * (starter/shopix/src/views/pages/product/related-products.tsx), rendered
 * with the shared StoreProductCard as a static responsive grid instead of a
 * shadcn Carousel (not needed for the handful of same-category items this
 * queries).
 */
export interface RelatedProductsProps {
  tenantSlug: string;
  products: StoreProductCardProduct[];
}

export function RelatedProducts({
  tenantSlug,
  products,
}: RelatedProductsProps): React.ReactNode {
  if (products.length === 0) return null;

  return (
    <section data-fdl="related-products" className="space-y-6">
      <h2 className="text-2xl font-semibold">You May Also Like</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <StoreProductCard
            key={product.id}
            tenantSlug={tenantSlug}
            product={product}
          />
        ))}
      </div>
    </section>
  );
}
