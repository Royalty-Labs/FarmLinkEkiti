import { useCallback, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import * as api from "../../api/endpoints";
import { useAuth } from "../../auth/useAuth";
import { EmptyState, Notice, PageLoader } from "../../components/Feedback";
import { TextAreaField } from "../../components/Fields";
import { Icon, VerifiedMark } from "../../components/Icon";
import { ProductThumb } from "../../components/ProductThumb";
import { dateTime, naira, quantity } from "../../lib/format";
import { errorMessage, useApi } from "../../lib/useApi";

export default function ProductDetail() {
  const { productId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const load = useCallback(() => api.getProduct(productId), [productId]);
  const { data: product, error, loading } = useApi(load);

  const [qty, setQty] = useState(1);
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <PageLoader label="Loading product" />;

  if (!product) {
    return (
      <main className="page">
        <EmptyState
          title="This listing isn't available"
          body={error ?? "It may have sold out or been removed by the farmer."}
          action={<Link to="/shop" className="btn btn--ink">Back to the market</Link>}
        />
      </main>
    );
  }

  const stock = Number(product.quantity_available);
  const maxQty = Math.max(1, Math.floor(stock));
  const total = Number(product.price_per_unit) * qty;
  const canOrder = !user || user.role === "buyer";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!product) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await api.placeOrder({
        product_id: product.id,
        quantity: String(qty),
        delivery_address: address.trim(),
        buyer_note: note.trim() || null,
      });
      navigate("/orders", { state: { placed: true } });
    } catch (err) {
      setSubmitError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="product" onSubmit={handleSubmit}>
      <div className="product__media">
        <ProductThumb name={product.name} imageUrl={product.image_url} className="product__img" />
        <Link to="/shop" className="icon-button icon-button--ink product__back" aria-label="Back to the market">
          <Icon name="chevronLeft" size={20} strokeWidth={2} />
        </Link>
      </div>

      <div className="page page--flush-top">
        <div className="product__head">
          <span className="muted small">{product.category}</span>
          <div className="product__title-row">
            <h1 className="product__title">{product.name}</h1>
            <span className="product__price">
              {naira(product.price_per_unit)}
              <span className="muted"> / {product.unit}</span>
            </span>
          </div>
        </div>

        <dl className="details">
          <div>
            <dt>Sold by</dt>
            <dd className="details__strong">
              {product.farm_name ?? "Verified farm"} <VerifiedMark />
            </dd>
          </div>
          <div>
            <dt>Farm location</dt>
            <dd>{product.location}</dd>
          </div>
          <div>
            <dt>In stock</dt>
            <dd>
              {quantity(product.quantity_available)} {product.unit}
            </dd>
          </div>
          <div>
            <dt>Listed</dt>
            <dd>{dateTime(product.created_at)}</dd>
          </div>
        </dl>

        {product.description && <p className="product__desc">{product.description}</p>}

        {canOrder ? (
          <>
            <div className="qty-row">
              <span className="qty-row__label">Quantity</span>
              <div className="stepper">
                <button type="button" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  <Icon name="minus" size={18} strokeWidth={2} />
                </button>
                <output aria-live="polite">
                  {qty} {product.unit}
                </output>
                <button type="button" aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(maxQty, q + 1))}>
                  <Icon name="plus" size={18} strokeWidth={2} />
                </button>
              </div>
            </div>

            <TextAreaField
              id="address"
              label="Delivery address"
              rows={2}
              required
              minLength={5}
              placeholder="Street, area, town"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <TextAreaField
              id="note"
              label="Note for the farmer"
              optional
              rows={2}
              placeholder="e.g. Please pick firm ones"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {submitError && <Notice tone="error">{submitError}</Notice>}
          </>
        ) : (
          <Notice>You're signed in as a {user?.role}. Use a buyer account to place orders.</Notice>
        )}
      </div>

      {canOrder && (
        <div className="action-bar">
          <div className="action-bar__total">
            <span className="action-bar__label">Total</span>
            <span className="action-bar__value">{naira(total)}</span>
          </div>
          {user ? (
            <button className="btn btn--lime btn--grow" disabled={busy}>
              {busy ? "Placing order…" : "Place order"}
            </button>
          ) : (
            <Link
              to={`/login?next=${encodeURIComponent(`/shop/products/${product.id}`)}`}
              className="btn btn--lime btn--grow"
            >
              Sign in to order
            </Link>
          )}
        </div>
      )}
    </form>
  );
}
