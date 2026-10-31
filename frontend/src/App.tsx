import { useCallback, useEffect, useState } from "react";
import { apiRequest, clearToken, getToken, saveToken } from "./api/client";
import type { AuthResponse, FarmerProfile, Product, User } from "./types";
import AdminDashboard from "./AdminDashboard";
import "./App.css";

type Page = "marketplace" | "dashboard" | "account" | "admin";
type AuthMode = "login" | "register";

const money = (value: number | string) =>
  `₦${Number(value).toLocaleString("en-NG", {
    maximumFractionDigits: 2,
  })}`;

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [profile, setProfile] = useState<FarmerProfile | null>(null);
  const [page, setPage] = useState<Page>("marketplace");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [authForm, setAuthForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "buyer",
  });

  const [profileForm, setProfileForm] = useState({
    farm_name: "",
    phone: "",
    town: "",
    address: "",
  });

  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    category: "Vegetables",
    price_per_unit: "",
    unit: "kg",
    quantity_available: "",
  });

  const loadProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (category) params.set("category", category);
      const suffix = params.size ? `?${params.toString()}` : "";
      const result = await apiRequest<Product[]>(`/products${suffix}`);
      setProducts(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load products.");
    }
  }, [search, category]);

  const loadDashboard = useCallback(async () => {
    if (!user) return;

    if (user.role === "farmer") {
      try {
        const result = await apiRequest<FarmerProfile>("/farmers/me/profile");
        setProfile(result);
        setProfileForm({
          farm_name: result.farm_name,
          phone: result.phone,
          town: result.town,
          address: result.address ?? "",
        });
      } catch {
        setProfile(null);
      }

      try {
        const result = await apiRequest<Product[]>("/products/mine");
        setMyProducts(result);
      } catch {
        setMyProducts([]);
      }
    }
  }, [user]);

  useEffect(() => {
    let active = true;

    async function initialise() {
      try {
        if (getToken()) {
          const currentUser = await apiRequest<User>("/auth/me");
          if (active) {
            setUser(currentUser);
            if (currentUser.role === "admin") setPage("admin");
            else if (currentUser.role === "farmer") setPage("dashboard");
          }
        }
      } catch {
        clearToken();
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialise();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (authMode === "register") {
        await apiRequest<User>("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            full_name: authForm.full_name,
            email: authForm.email,
            password: authForm.password,
            role: authForm.role,
          }),
        });
      }

      const response = await apiRequest<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: authForm.email,
          password: authForm.password,
        }),
      });

      saveToken(response.access_token);
      setUser(response.user);
      setPage(
        response.user.role === "admin"
          ? "admin"
          : response.user.role === "farmer"
            ? "dashboard"
            : "marketplace",
      );
      setMessage(`Welcome, ${response.user.full_name.split(" ")[0]}!`);
      setAuthForm({ full_name: "", email: "", password: "", role: "buyer" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    clearToken();
    setUser(null);
    setProfile(null);
    setMyProducts([]);
    setPage("marketplace");
    setMessage("You have signed out.");
    setError("");
  }

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        farm_name: profileForm.farm_name,
        phone: profileForm.phone,
        town: profileForm.town,
        address: profileForm.address || null,
      };

      const result = await apiRequest<FarmerProfile>("/farmers/me/profile", {
        method: profile ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });

      setProfile(result);
      setMessage(
        result.verification_status === "pending"
          ? "Your farm profile has been submitted for verification."
          : "Your farm profile has been updated.",
      );
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setBusy(false);
    }
  }

  async function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await apiRequest<Product>("/products", {
        method: "POST",
        body: JSON.stringify({
          ...productForm,
          description: productForm.description || null,
          price_per_unit: Number(productForm.price_per_unit),
          quantity_available: Number(productForm.quantity_available),
        }),
      });

      setProductForm({
        name: "",
        description: "",
        category: "Vegetables",
        price_per_unit: "",
        unit: "kg",
        quantity_available: "",
      });
      setMessage("Your product has been listed.");
      await loadDashboard();
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not list product.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleProduct(product: Product) {
    setError("");
    setMessage("");

    try {
      await apiRequest<Product>(`/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_available: !product.is_available }),
      });
      setMessage("Product availability updated.");
      await loadDashboard();
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update product.");
    }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Delete "${product.name}" from your listings?`)) return;

    setError("");
    setMessage("");

    try {
      await apiRequest<void>(`/products/${product.id}`, { method: "DELETE" });
      setMessage("Product deleted.");
      await loadDashboard();
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete product.");
    }
  }

  const categories = [
    "Vegetables",
    "Fruits",
    "Grains",
    "Tubers",
    "Poultry",
    "Livestock",
    "Other",
  ];

  if (loading) {
    return <main className="loading-screen">Loading FarmLink Ekiti…</main>;
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" onClick={() => setPage("marketplace")}>
          <span className="brand-mark">F</span>
          <span>
            <strong>FarmLink</strong>
            <small>EKITI STATE</small>
          </span>
        </button>

        <nav className="main-nav" aria-label="Main navigation">
          <button
            className={page === "marketplace" ? "nav-link active" : "nav-link"}
            onClick={() => setPage("marketplace")}
          >
            Marketplace
          </button>
          {user?.role === "farmer" && (
            <button
              className={page === "dashboard" ? "nav-link active" : "nav-link"}
              onClick={() => setPage("dashboard")}
            >
              Farmer dashboard
            </button>
          )}
          {user?.role === "admin" && (
            <button
              className={page === "admin" ? "nav-link active" : "nav-link"}
              onClick={() => setPage("admin")}
            >
              Admin dashboard
            </button>
          )}
        </nav>

        <div className="header-actions">
          {user ? (
            <>
              <span className="user-greeting">
                Hi, {user.full_name.split(" ")[0]}
              </span>
              <button className="button button-outline button-small" onClick={logout}>
                Sign out
              </button>
            </>
          ) : (
            <button
              className="button button-primary button-small"
              onClick={() => {
                setPage("account");
                setAuthMode("login");
              }}
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      <main>
        {(message || error) && (
          <div className={`notice ${error ? "notice-error" : "notice-success"}`}>
            <span>{error || message}</span>
            <button
              aria-label="Dismiss message"
              onClick={() => {
                setMessage("");
                setError("");
              }}
            >
              ×
            </button>
          </div>
        )}

        {page === "marketplace" && (
          <>
            <section className="hero">
              <div className="hero-content">
                <span className="eyebrow">GROWN IN EKITI. CONNECTED TO YOU.</span>
                <h1>Good food starts<br />with <span>good connections.</span></h1>
                <p>
                  Discover fresh farm produce from farmers across Ado-Ekiti and
                  surrounding communities.
                </p>
                <button
                  className="button button-light"
                  onClick={() =>
                    document.getElementById("marketplace")?.scrollIntoView({
                      behavior: "smooth",
                    })
                  }
                >
                  Explore produce <span aria-hidden="true">↓</span>
                </button>
              </div>
              <div className="hero-art" aria-hidden="true">
                <span className="sun-shape" />
                <span className="leaf leaf-one" />
                <span className="leaf leaf-two" />
                <span className="produce-basket">🌽</span>
                <span className="produce-tomato">🍅</span>
                <span className="produce-leaves">🥬</span>
              </div>
              <div className="hero-bottom">
                <span>LOCAL FARMERS</span><span>FRESH PRODUCE</span><span>EKITI FIRST</span>
              </div>
            </section>

            <section className="market-section" id="marketplace">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">THE MARKETPLACE</span>
                  <h2>Fresh from the farm</h2>
                  <p>Browse produce listed by verified farmers.</p>
                </div>
                {user?.role === "farmer" ? (
                  <button className="button button-primary" onClick={() => setPage("dashboard")}>
                    Manage my farm
                  </button>
                ) : (
                  <button
                    className="button button-outline"
                    onClick={() => {
                      setPage("account");
                      setAuthMode("register");
                      setAuthForm((old) => ({ ...old, role: "farmer" }));
                    }}
                  >
                    Become a seller <span aria-hidden="true">↗</span>
                  </button>
                )}
              </div>

              <div className="search-bar">
                <label className="search-input">
                  <span aria-hidden="true">⌕</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search tomatoes, yam, maize…"
                    aria-label="Search products"
                  />
                </label>
                <label className="category-select">
                  <span>Category</span>
                  <select value={category} onChange={(event) => setCategory(event.target.value)}>
                    <option value="">All produce</option>
                    {categories.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </div>

              <div className="results-line">
                <span>{products.length} {products.length === 1 ? "listing" : "listings"} available</span>
                <span>Showing available produce</span>
              </div>

              {products.length ? (
                <div className="product-grid">
                  {products.map((product, index) => (
                    <article className="product-card" key={product.id}>
                      <div className={`product-visual product-visual-${index % 5}`}>
                        <span className="product-category">{product.category}</span>
                        <span className="product-emoji" aria-hidden="true">
                          {({
                            Vegetables: "🥬",
                            Fruits: "🍊",
                            Grains: "🌽",
                            Tubers: "🍠",
                            Poultry: "🐓",
                            Livestock: "🐐",
                          } as Record<string, string>)[product.category] ?? "🌱"}
                        </span>
                      </div>
                      <div className="product-details">
                        <div className="product-title-row">
                          <h3>{product.name}</h3>
                          <span className="available-dot" title="Available" />
                        </div>
                        <p className="product-location">⌖ {product.location}</p>
                        {product.description && <p className="product-description">{product.description}</p>}
                        <div className="product-price-row">
                          <div>
                            <strong>{money(product.price_per_unit)}</strong>
                            <span> / {product.unit}</span>
                          </div>
                          <span className="stock-label">
                            {Number(product.quantity_available).toLocaleString()} {product.unit} in stock
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon">🌱</span>
                  <h3>No produce found just yet</h3>
                  <p>Try another search or category. New listings will appear here as farmers join.</p>
                  <button
                    className="button button-outline"
                    onClick={() => {
                      setSearch("");
                      setCategory("");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </section>

            <section className="join-banner">
              <div>
                <span className="eyebrow">GROW WITH FARMLINK</span>
                <h2>Are you a farmer in Ekiti?</h2>
                <p>Bring your produce online and connect with more people looking for fresh food.</p>
              </div>
              <button
                className="button button-light"
                onClick={() => {
                  setPage("account");
                  setAuthMode("register");
                  setAuthForm((old) => ({ ...old, role: "farmer" }));
                }}
              >
                Join as a farmer <span aria-hidden="true">↗</span>
              </button>
            </section>
          </>
        )}

        {page === "account" && (
          <section className="account-layout">
            <div className="account-intro">
              <span className="eyebrow">WELCOME TO FARMLINK</span>
              <h1>Closer to the<br /><span>source.</span></h1>
              <p>Find local produce or bring your farm to a wider market, one connection at a time.</p>
              <div className="account-points">
                <span>✓ Discover local produce</span>
                <span>✓ Connect with Ekiti farmers</span>
                <span>✓ Manage your listings in one place</span>
              </div>
            </div>

            <div className="form-card">
              <div className="form-tabs">
                <button
                  className={authMode === "login" ? "form-tab selected" : "form-tab"}
                  onClick={() => setAuthMode("login")}
                >
                  Sign in
                </button>
                <button
                  className={authMode === "register" ? "form-tab selected" : "form-tab"}
                  onClick={() => setAuthMode("register")}
                >
                  Create account
                </button>
              </div>

              <h2>{authMode === "login" ? "Welcome back" : "Join the marketplace"}</h2>
              <p className="form-subtitle">
                {authMode === "login"
                  ? "Enter your details to continue."
                  : "Create an account to get started."}
              </p>

              <form onSubmit={submitAuth} className="stacked-form">
                {authMode === "register" && (
                  <>
                    <label>
                      Full name
                      <input
                        required
                        minLength={2}
                        value={authForm.full_name}
                        onChange={(event) => setAuthForm({ ...authForm, full_name: event.target.value })}
                        placeholder="Your full name"
                      />
                    </label>
                    <label>
                      I want to
                      <select
                        value={authForm.role}
                        onChange={(event) => setAuthForm({ ...authForm, role: event.target.value })}
                      >
                        <option value="buyer">Buy farm produce</option>
                        <option value="farmer">Sell my produce</option>
                      </select>
                    </label>
                  </>
                )}
                <label>
                  Email address
                  <input
                    required
                    type="email"
                    value={authForm.email}
                    onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                    placeholder="you@example.com"
                  />
                </label>
                <label>
                  Password
                  <input
                    required
                    minLength={authMode === "register" ? 8 : 1}
                    type="password"
                    value={authForm.password}
                    onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                    placeholder={authMode === "register" ? "At least 8 characters" : "Your password"}
                  />
                </label>
                <button className="button button-primary button-full" disabled={busy}>
                  {busy ? "Please wait…" : authMode === "login" ? "Sign in" : "Create account"}
                </button>
              </form>
              <p className="switch-auth">
                {authMode === "login" ? "New to FarmLink? " : "Already have an account? "}
                <button onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>
                  {authMode === "login" ? "Create an account" : "Sign in"}
                </button>
              </p>
            </div>
          </section>
        )}

        {page === "admin" && user?.role === "admin" && (
          <AdminDashboard onMessage={setMessage} onError={setError} />
        )}

        {page === "dashboard" && user?.role === "farmer" && (
          <section className="dashboard-section">
            <div className="dashboard-heading">
              <div>
                <span className="eyebrow">YOUR FARM SPACE</span>
                <h1>Farmer dashboard</h1>
                <p>Manage your profile and the produce you list on FarmLink.</p>
              </div>
              <button className="button button-outline" onClick={() => setPage("marketplace")}>
                View marketplace ↗
              </button>
            </div>

            <div className="dashboard-grid">
              <div className="dashboard-main">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Farm profile</h2>
                      <p>Tell buyers and our team about your farm.</p>
                    </div>
                    {profile && (
                      <span className={`status status-${profile.verification_status}`}>
                        {profile.verification_status}
                      </span>
                    )}
                  </div>

                  {profile?.verification_status === "rejected" && profile.rejection_reason && (
                    <div className="rejection-note">
                      <strong>Changes requested</strong>
                      <p>{profile.rejection_reason}</p>
                      <small>Update your information and submit again for review.</small>
                    </div>
                  )}
                  {profile?.verification_status === "pending" && (
                    <div className="status-note">
                      Your profile is awaiting review. You can update your information while you wait.
                    </div>
                  )}
                  {profile?.verification_status === "approved" && (
                    <div className="success-note">
                      Your farm is approved. You can publish and manage product listings below.
                    </div>
                  )}

                  <form onSubmit={submitProfile} className="stacked-form">
                    <label>
                      Farm name
                      <input
                        required
                        minLength={2}
                        value={profileForm.farm_name}
                        onChange={(event) => setProfileForm({ ...profileForm, farm_name: event.target.value })}
                        placeholder="e.g. Green Acres Farm"
                      />
                    </label>
                    <div className="form-row">
                      <label>
                        Phone number
                        <input
                          required
                          minLength={7}
                          value={profileForm.phone}
                          onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })}
                          placeholder="Your contact number"
                        />
                      </label>
                      <label>
                        Town or community
                        <input
                          required
                          minLength={2}
                          value={profileForm.town}
                          onChange={(event) => setProfileForm({ ...profileForm, town: event.target.value })}
                          placeholder="e.g. Ado-Ekiti"
                        />
                      </label>
                    </div>
                    <label>
                      Farm address (optional)
                      <textarea
                        rows={3}
                        value={profileForm.address}
                        onChange={(event) => setProfileForm({ ...profileForm, address: event.target.value })}
                        placeholder="Add directions or a more detailed address"
                      />
                    </label>
                    <button className="button button-primary" disabled={busy}>
                      {busy ? "Saving…" : profile ? "Update farm profile" : "Submit for verification"}
                    </button>
                  </form>
                </section>

                <section className="panel" id="product-form">
                  <div className="panel-heading">
                    <div>
                      <h2>List new produce</h2>
                      <p>Add a product for buyers to discover.</p>
                    </div>
                  </div>
                  {profile?.verification_status !== "approved" ? (
                    <div className="locked-state">
                      <span aria-hidden="true">🔒</span>
                      <div>
                        <strong>Verification required</strong>
                        <p>Your farm profile must be approved before you can publish products.</p>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={submitProduct} className="stacked-form">
                      <label>
                        Product name
                        <input
                          required
                          minLength={2}
                          value={productForm.name}
                          onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
                          placeholder="e.g. Fresh tomatoes"
                        />
                      </label>
                      <label>
                        Description (optional)
                        <textarea
                          rows={3}
                          value={productForm.description}
                          onChange={(event) => setProductForm({ ...productForm, description: event.target.value })}
                          placeholder="Describe your produce"
                        />
                      </label>
                      <div className="form-row">
                        <label>
                          Category
                          <select
                            value={productForm.category}
                            onChange={(event) => setProductForm({ ...productForm, category: event.target.value })}
                          >
                            {categories.map((item) => <option key={item}>{item}</option>)}
                          </select>
                        </label>
                        <label>
                          Unit
                          <select
                            value={productForm.unit}
                            onChange={(event) => setProductForm({ ...productForm, unit: event.target.value })}
                          >
                            {["kg", "bag", "basket", "crate", "piece", "litre", "bunch"].map((item) => (
                              <option key={item}>{item}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="form-row">
                        <label>
                          Price per unit (₦)
                          <input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            value={productForm.price_per_unit}
                            onChange={(event) => setProductForm({ ...productForm, price_per_unit: event.target.value })}
                            placeholder="0.00"
                          />
                        </label>
                        <label>
                          Available quantity
                          <input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            value={productForm.quantity_available}
                            onChange={(event) => setProductForm({ ...productForm, quantity_available: event.target.value })}
                            placeholder="e.g. 50"
                          />
                        </label>
                      </div>
                      <button className="button button-primary" disabled={busy}>
                        {busy ? "Publishing…" : "Publish product"}
                      </button>
                    </form>
                  )}
                </section>
              </div>

              <aside className="dashboard-side">
                <section className="panel">
                  <h2>Your account</h2>
                  <div className="profile-summary">
                    <span className="avatar">{user.full_name.charAt(0).toUpperCase()}</span>
                    <div>
                      <strong>{user.full_name}</strong>
                      <span>{user.email}</span>
                    </div>
                  </div>
                  <div className="summary-line">
                    <span>Farm status</span>
                    <strong>{profile?.verification_status ?? "Not submitted"}</strong>
                  </div>
                  <div className="summary-line">
                    <span>Product listings</span>
                    <strong>{myProducts.length}</strong>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Your listings</h2>
                      <p>Manage your published products.</p>
                    </div>
                  </div>
                  {myProducts.length ? (
                    <div className="my-products">
                      {myProducts.map((product) => (
                        <div className="my-product" key={product.id}>
                          <div className="my-product-info">
                            <strong>{product.name}</strong>
                            <span>{money(product.price_per_unit)} / {product.unit}</span>
                            <small>{product.is_available ? "Available" : "Hidden from marketplace"}</small>
                          </div>
                          <div className="my-product-actions">
                            <button
                              className="text-button"
                              onClick={() => void toggleProduct(product)}
                            >
                              {product.is_available ? "Hide" : "Show"}
                            </button>
                            <button
                              className="text-button danger-text"
                              onClick={() => void deleteProduct(product)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted-copy">Your listings will appear here after you publish a product.</p>
                  )}
                </section>
              </aside>
            </div>
          </section>
        )}
      </main>

      <footer className="site-footer">
        <div className="footer-brand">
          <span className="brand-mark">F</span>
          <span><strong>FarmLink Ekiti</strong><small>Connecting farms to communities.</small></span>
        </div>
        <span>Built for the Ado-Ekiti pilot · Ekiti State, Nigeria</span>
      </footer>
    </div>
  );
}

export default App;
