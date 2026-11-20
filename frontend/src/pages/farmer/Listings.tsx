import { useCallback, useState } from "react";
import { Link, useLocation } from "react-router";
import * as api from "../../api/endpoints";
import { EmptyState, Notice, PageLoader } from "../../components/Feedback";
import { Icon } from "../../components/Icon";
import { ProductThumb } from "../../components/ProductThumb";
import { naira, quantity } from "../../lib/format";
import { errorMessage, useApi } from "../../lib/useApi";
import type { Product } from "../../types";

export default function Listings() {
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash;
  const load = useCallback(() => api.listMyProducts(), []);
  const { data, error, loading, reload } = useApi(load);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(product: Product, action: () => Promise<unknown>) {
    setBusyId(product.id);
    setActionError(null);
    try {
      await action();
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <header className="ink-header">
        <div className="ink-header__row">
          <h1 className="ink-header__heading">Listings</h1>
          <Link to="/farm/listings/new" className="btn btn--lime btn--sm">
            <Icon name="plus" size={16} strokeWidth={2.4} /> New listing
          </Link>
        </div>
      </header>

      <main className="page">
        {flash && <Notice tone="success">{flash}</Notice>}
        {(error || actionError) && (
          <Notice tone="error">{error ?? actionError}</Notice>
        )}

        {loading && !data ? (
          <PageLoader label="Loading listings" />
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="No listings yet"
            body="Add your first produce so buyers can order it."
            action={
              <Link to="/farm/listings/new" className="btn btn--ink">
                New listing
              </Link>
            }
          />
        ) : (
          <ul className="rows">
            {data.map((product) => {
              const stock = Number(product.quantity_available);
              const state = !product.is_available
                ? "Paused"
                : stock <= 0
                  ? "Sold out"
                  : stock <= 5
                    ? "Running low"
                    : "Live";

              return (
                <li key={product.id} className="row row--static">
                  <ProductThumb
                    name={product.name}
                    imageUrl={product.image_url}
                    className="row__thumb"
                  />

                  <span className="row__main">
                    <span className="row__title">{product.name}</span>
                    <span className="row__sub">
                      {naira(product.price_per_unit)} / {product.unit} ·{" "}
                      {quantity(stock)} in stock
                    </span>
                    <span
                      className={`listing-state listing-state--${state
                        .toLowerCase()
                        .replace(" ", "-")}`}
                    >
                      {state}
                    </span>
                  </span>

                  <span className="row__actions">
                    <Link
                      to={`/farm/listings/${product.id}/edit`}
                      className="btn btn--outline btn--sm"
                    >
                      Edit
                    </Link>

                    <button
                      className="btn btn--outline btn--sm"
                      disabled={busyId === product.id}
                      onClick={() =>
                        run(product, () =>
                          api.updateProduct(product.id, {
                            is_available: !product.is_available,
                          }),
                        )
                      }
                    >
                      {product.is_available ? "Pause" : "Resume"}
                    </button>

                    <button
                      className="icon-button"
                      aria-label={`Delete ${product.name}`}
                      disabled={busyId === product.id}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete ${product.name}? Buyers will no longer see it.`,
                          )
                        ) {
                          run(product, () => api.deleteProduct(product.id));
                        }
                      }}
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
