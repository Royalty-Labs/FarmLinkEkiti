import { useCallback, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import * as api from "../../api/endpoints";
import { Notice, PageLoader } from "../../components/Feedback";
import { SelectField, TextAreaField, TextField } from "../../components/Fields";
import { Icon } from "../../components/Icon";
import { CATEGORIES, UNITS } from "../../lib/format";
import { errorMessage, useApi } from "../../lib/useApi";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function NewListing() {
  const navigate = useNavigate();
  const loadProfile = useCallback(() => api.getMyProfile(), []);
  const profile = useApi(loadProfile);

  const [form, setForm] = useState({
    name: "",
    category: CATEGORIES[0],
    price: "",
    unit: UNITS[0],
    stock: "",
    description: "",
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (profile.loading) return <PageLoader />;
  const farm = profile.data ?? null;

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    if (file && !PHOTO_TYPES.includes(file.type)) {
      setError("Use a JPEG, PNG or WebP photo.");
      return;
    }
    if (file && file.size > MAX_PHOTO_BYTES) {
      setError("That photo is over 5 MB. Try a smaller one.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    let flash = "Your listing is live.";
    try {
      const product = await api.createProduct({
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
          flash = `Your listing is live, but the photo didn't upload: ${errorMessage(err)}`;
        }
      }
      navigate("/farm/listings", { replace: true, state: { flash } });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="screen" onSubmit={handleSubmit}>
      <header className="ink-header ink-header--bar">
        <Link to="/farm/listings" className="icon-button icon-button--dark" aria-label="Back to listings">
          <Icon name="chevronLeft" size={20} strokeWidth={2} />
        </Link>
        <h1 className="ink-header__bar-title">New listing</h1>
      </header>

      <main className="page page--with-action">
        {farm?.verification_status !== "approved" ? (
          <Notice tone="warning">
            You can list produce once your farm is verified.{" "}
            <Link to="/farm/profile">{farm ? "Check your farm status" : "Set up your farm"}</Link>
          </Notice>
        ) : (
          <>
            <div className="photo-pick">
              <label className="photo-pick__box">
                {preview ? (
                  <img src={preview} alt="Selected produce" className="photo-pick__img" />
                ) : (
                  <>
                    <Icon name="camera" size={22} />
                    <span>Add photo</span>
                  </>
                )}
                <input type="file" accept={PHOTO_TYPES.join(",")} onChange={choosePhoto} className="sr-only" />
              </label>
              <div className="photo-pick__text">
                <span className="photo-pick__title">Clear photos sell faster</span>
                <span>Shoot in daylight and show the real produce. JPEG, PNG or WebP, up to 5 MB.</span>
              </div>
            </div>

            <TextField
              id="name"
              label="Name"
              required
              minLength={2}
              maxLength={150}
              placeholder="e.g. Tomatoes"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <SelectField
              id="category"
              label="Category"
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
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
                placeholder="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
              <SelectField
                id="unit"
                label="Unit"
                options={UNITS.map((u) => ({ value: u, label: `per ${u}` }))}
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
              placeholder="How many units can you sell?"
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
              Shown as from <strong>{farm.town}, {farm.state}</strong> (your farm profile).
            </p>
            {error && <Notice tone="error">{error}</Notice>}
          </>
        )}
      </main>

      {farm?.verification_status === "approved" && (
        <div className="action-bar">
          <button className="btn btn--lime btn--grow" disabled={busy}>
            {busy ? "Publishing…" : "Publish"}
          </button>
        </div>
      )}
    </form>
  );
}
