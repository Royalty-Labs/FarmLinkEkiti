import { useCallback, useDeferredValue, useState } from "react";
import { Link } from "react-router";
import * as api from "../../api/endpoints";
import { useAuth } from "../../auth/useAuth";
import { EmptyState, Notice, PageLoader } from "../../components/Feedback";
import { Icon } from "../../components/Icon";
import { ProductThumb } from "../../components/ProductThumb";
import { CATEGORIES, naira, toDate } from "../../lib/format";
import { useApi } from "../../lib/useApi";
import type { Product } from "../../types";

const TABS = ["All", ...CATEGORIES];

function isFreshToday(product: Product) {
  return Date.now() - toDate(product.created_at).getTime() < 24 * 60 * 60 * 1000;
}

export default function Shop() {
  const { user } = useAuth();
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim());

  const load = useCallback(
    () => api.listProducts({ category: category === "All" ? undefined : category, search: query || undefined }),
    [category, query],
  );
  const { data: products, error, loading } = useApi(load);

  const featured = products?.slice(0, 2) ?? [];
  const rest = products?.slice(2) ?? [];

  return (
    <>
      <header className="ink-header">
        <div className="ink-header__row">
          <div className="ink-header__place">
            <span className="ink-header__eyebrow">Delivering in</span>
            <span className="ink-header__title">Ado-Ekiti</span>
          </div>
          {!user && (
            <Link to="/login?next=/shop" className="btn btn--ghost-dark btn--sm">
              Sign in
            </Link>
          )}
        </div>
        <label className="search">
          <Icon name="search" size={18} />
          <input
            type="search"
            aria-label="Search produce"
            placeholder="Search produce"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="tabs tabs--dark" role="tablist" aria-label="Categories">
          {TABS.map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={category === tab}
              className={`tabs__tab${category === tab ? " is-active" : ""}`}
              onClick={() => setCategory(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      <main className="page">
        {error && <Notice tone="error">{error}</Notice>}
        {loading && !products ? (
          <PageLoader label="Loading produce" />
        ) : products && products.length === 0 ? (
          <EmptyState
            title={query ? `Nothing matches “${query}”` : "No produce listed here yet"}
            body="Farmers add new harvests every day. Try another category or check back soon."
          />
        ) : (
          <>
            <section className="section">
              <h2 className="section__title">Fresh this week</h2>
              <div className="tile-grid">
                {featured.map((product) => (
                  <Link key={product.id} to={`/shop/products/${product.id}`} className="tile">
                    <div className="tile__media">
                      <ProductThumb name={product.name} imageUrl={product.image_url} className="tile__img" />
                      {isFreshToday(product) && <span className="tag tag--ink">Listed today</span>}
                    </div>
                    <span className="tile__name">{product.name}</span>
                    <span className="tile__farm">{product.farm_name ?? product.location}</span>
                    <span className="tile__price">
                      {naira(product.price_per_unit)} <span className="muted">/ {product.unit}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>

            {rest.length > 0 && (
              <section className="section">
                <h2 className="section__title">From farms near you</h2>
                <ul className="rows">
                  {rest.map((product) => (
                    <li key={product.id}>
                      <Link to={`/shop/products/${product.id}`} className="row">
                        <ProductThumb name={product.name} imageUrl={product.image_url} className="row__thumb" />
                        <span className="row__main">
                          <span className="row__title">{product.name}</span>
                          <span className="row__sub">
                            {product.farm_name ?? "Verified farm"} · {product.location.split(",")[0]}
                          </span>
                        </span>
                        <span className="row__end">
                          <span className="row__title">{naira(product.price_per_unit)}</span>
                          <span className="row__sub">per {product.unit}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
