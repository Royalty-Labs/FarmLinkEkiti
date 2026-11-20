import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import * as api from "../../api/endpoints";
import { Notice, PageLoader } from "../../components/Feedback";
import { SelectField, TextAreaField, TextField } from "../../components/Fields";
import { Icon } from "../../components/Icon";
import { CATEGORIES, UNITS } from "../../lib/format";
import { errorMessage, useApi } from "../../lib/useApi";
import type { Product } from "../../types";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function EditListing() {
  const { productId } = useParams();
  const load = useCallback(() => api.listMyProducts(), []);
  const { data, error, loading } = useApi(load);

  if (loading && !data) return <PageLoader label="Loading listing" />;

  const product = data?.find((item) => item.id === productId);

  if (error) {
    return (
      <main className="page">
        <Notice tone="error">{error}</Notice>
        <Link to="/farm/listings">Back to listings</Link>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="page">
        <Notice tone="warning">This listing could not be found in your farmer account.</Notice>
        <Link to="/farm/listings">Back to listings</Link>
      </main>
    );
  }

  return <EditListingForm product={product} />;
}

function EditListingForm({ product }: { product: Product }) {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: product.name,
    category: product.category,
    price: String(product.price_per_unit),
    unit: product.unit,
    stock: String(product.quantity_available),
    description: product.description ?? "",
  });

  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);

    if (file && !PHOTO_TYPES.includes(file.type)) {
      setError("Use a JPEG, PNG or WebP photo.");
      event.target.value = "";
      return;
    }

    if (file && file.size > MAX_PHOTO_BYTES) {
      setError("That photo is over 5 MB. Try a smaller one.");
      event.target.value = "";
      return;
    }

    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await api.updateProduct(product.id, {
        name: form.name.trim(),
        category: form.category,
        price_per_unit: form.price,
        unit: form.unit,
        quantity_available: form.stock,
        description: form.description.trim() || null,
      });

      if (photo) {
        try {
          await api.uploadProductImage(product.id, photo);
        } catch (err) {
          setError(
            `Your product details were saved, but the photo could not be uploaded: ${errorMessage(err)}`
          );
          setBusy(false);
          return;
        }
      }

      navigate("/farm/listings", {
        replace: true,
        state: { flash: "Your listing has been updated successfully." },
      });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const displayedPhoto = preview ?? product.image_url;

  return (
    <form className="screen" onSubmit={handleSubmit}>
      <header className="ink-header ink-header--bar">
        <Link
          to="/farm/listings"
          className="icon-button icon-button--dark"
          aria-label="Back to listings"
        >
          <Icon name="chevronLeft" size={20} strokeWidth={2} />
        </Link>
        <h1 className="ink-header__bar-title">Edit listing</h1>
      </header>

      <main className="page page--with-action">
        <div className="photo-pick">
          <label className="photo-pick__box">
            {displayedPhoto ? (
              <img
                src={displayedPhoto}
                alt={product.name}
                className="photo-pick__img"
              />
            ) : (
              <>
                <Icon name="camera" size={22} />
                <span>Add photo</span>
              </>
            )}
            <input
              type="file"
              accept={PHOTO_TYPES.join(",")}
              onChange={choosePhoto}
              className="sr-only"
            />
          </label>
          <div className="photo-pick__text">
            <span className="photo-pick__title">
              {product.image_url ? "Current product photo" : "No product photo yet"}
            </span>
            <span>
              Select a new photo to add or replace it. JPEG, PNG or WebP, up to 5 MB.
            </span>
          </div>
        </div>

        <TextField
          id="name"
          label="Name"
          required
          minLength={2}
          maxLength={150}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <SelectField
          id="category"
          label="Category"
          options={CATEGORIES.map((category) => ({
            value: category,
            label: category,
          }))}
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />

        <div className="form-grid">
          <TextField
            id="price"
            label="Price"
            prefix="₦"
            inputMode="decimal"
            required
            pattern="\d+(\.\d{1,2})?"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />

          <SelectField
            id="unit"
            label="Unit"
            options={UNITS.map((unit) => ({
              value: unit,
              label: `per ${unit}`,
            }))}
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
          />
        </div>

        <TextField
          id="stock"
          label="Quantity in stock"
          inputMode="decimal"
          required
          pattern="\d+(\.\d{1,2})?"
          value={form.stock}
          onChange={(e) => setForm({ ...form, stock: e.target.value })}
        />

        <TextAreaField
          id="description"
          label="Description"
          optional
          rows={3}
          placeholder="Variety, size, when it was harvested"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <p className="muted small">
          Product location: <strong>{product.location}</strong>. To change this,
          update your <Link to="/farm/profile">farm profile</Link>.
        </p>

        {error && <Notice tone="error">{error}</Notice>}
      </main>

      <div className="action-bar">
        <button className="btn btn--lime btn--grow" disabled={busy}>
          {busy ? "Saving changes…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
