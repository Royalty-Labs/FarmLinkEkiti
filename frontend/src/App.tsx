import { useCallback, useEffect, useState } from "react";
import {
  apiRequest,
  clearToken,
  getToken,
  saveToken,
  uploadProductImage,
} from "./api/client";

import type {
  AuthResponse,
  FarmerProfile,
  Order,
  Product,
  User,
} from "./types";
import AdminDashboard from "./AdminDashboard";
import "./App.css";
type Page =
  | "marketplace"
  | "product"
  | "orders"
  | "incoming-orders"
  | "dashboard"
  | "account"
  | "admin";
type AuthMode = "login" | "register";

const money = (value: number | string) =>
  `₦${Number(value).toLocaleString("en-NG", {
    maximumFractionDigits: 2,
  })}`;

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [farmerOrders, setFarmerOrders] = useState<Order[]>([]);
  const [farmerOrdersLoading, setFarmerOrdersLoading] = useState(false);
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [orderQuantity, setOrderQuantity] = useState("1");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [buyerNote, setBuyerNote] = useState("");
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

  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);

  useEffect(() => {
  if (!productImage) {
    setProductImagePreview(null);
    return;
  }

  const previewUrl = URL.createObjectURL(productImage);
  setProductImagePreview(previewUrl);

  return () => {
    URL.revokeObjectURL(previewUrl);
  };
}, [productImage]);


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

    const loadMyOrders = useCallback(async () => {
  if (!user || user.role !== "buyer") {
    setMyOrders([]);
    return;
  }

  setOrdersLoading(true);

  try {
    const result = await apiRequest<Order[]>("/orders/mine");
    setMyOrders(result);
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Could not load your orders.",
    );
  } finally {
    setOrdersLoading(false);
  }
}, [user]);

    const loadFarmerOrders = useCallback(async () => {
  if (!user || user.role !== "farmer") {
    setFarmerOrders([]);
    return;
  }

  setFarmerOrdersLoading(true);

  try {
    const result = await apiRequest<Order[]>("/orders/farmer");
    setFarmerOrders(result);
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Could not load incoming orders.",
    );
  } finally {
    setFarmerOrdersLoading(false);
  }
}, [user]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void loadMyOrders();
  }, [loadMyOrders]);

  useEffect(() => {
    void loadFarmerOrders();
  }, [loadFarmerOrders]);



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
    setMyOrders([]);
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
    const createdProduct = await apiRequest<Product>("/products", {
      method: "POST",
      body: JSON.stringify({
        ...productForm,
        description: productForm.description || null,
        price_per_unit: Number(productForm.price_per_unit),
        quantity_available: Number(productForm.quantity_available),
      }),
    });

    if (productImage) {
      await uploadProductImage(createdProduct.id, productImage);
    }

    setProductForm({
      name: "",
      description: "",
      category: "Vegetables",
      price_per_unit: "",
      unit: "kg",
      quantity_available: "",
    });

    setProductImage(null);

    setMessage("Your product has been listed.");
    await loadDashboard();
    await loadProducts();
  } catch (err) {
    setError(err instanceof Error ? err.message : "Could not list product.");
  } finally {
    setBusy(false);
  }
}


  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (!selectedProduct) return;

  if (!user) {
    setPage("account");
    setAuthMode("login");
    setMessage("Sign in with a buyer account to place an order.");
    return;
  }

  if (user.role !== "buyer") {
    setError("Only buyer accounts can place orders.");
    return;
  }

  const quantity = Number(orderQuantity);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    setError("Enter a valid quantity greater than zero.");
    return;
  }

  if (quantity > Number(selectedProduct.quantity_available)) {
    setError("The requested quantity exceeds the available stock.");
    return;
  }

  setBusy(true);
  setError("");
  setMessage("");

  try {
    await apiRequest<Order>("/orders", {
      method: "POST",
      body: JSON.stringify({
        product_id: selectedProduct.id,
        quantity,
        delivery_address: deliveryAddress.trim(),
        buyer_note: buyerNote.trim() || null,
      }),
    });

   setMessage(`Your order for ${selectedProduct.name} has been placed.`);
   setSelectedProduct(null);
   setOrderQuantity("1");
   setDeliveryAddress("");
   setBuyerNote("");

   await loadProducts();
   await loadMyOrders();

   setPage("orders");
  } catch (err) {
    setError(err instanceof Error ? err.message : "Could not place your order.");
  } finally {
    setBusy(false);
  }
}

  async function cancelOrder(order: Order) {
  if (order.status !== "pending") return;

  const confirmed = window.confirm(
    `Cancel your order for ${order.product_name}?`,
  );

  if (!confirmed) return;

  setBusy(true);
  setError("");
  setMessage("");

  try {
    await apiRequest<Order>(`/orders/${order.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled" }),
    });

    setMessage("Your order has been cancelled.");
    await loadMyOrders();
    await loadProducts();
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Could not cancel your order.",
    );
  } finally {
    setBusy(false);
  }
}

  async function updateFarmerOrderStatus(
  order: Order,
  status: "accepted" | "rejected" | "ready_for_fulfillment",
) {
  if (status === "rejected" && !rejectionReason.trim()) {
    setError("Please provide a reason for rejecting this order.");
    return;
  }

  setBusy(true);
  setError("");
  setMessage("");

  try {
    await apiRequest<Order>(`/orders/${order.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        rejection_reason:
          status === "rejected" ? rejectionReason.trim() : null,
      }),
    });

    const messages = {
      accepted: "Order accepted successfully.",
      rejected: "Order rejected. The reserved stock has been restored.",
      ready_for_fulfillment: "Order marked as ready for fulfillment.",
    };

    setMessage(messages[status]);
    setRejectingOrderId(null);
    setRejectionReason("");

    await loadFarmerOrders();
    await loadDashboard();
    await loadProducts();
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Could not update the order.",
    );
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
          {user?.role === "buyer" && (
  <button
    className={page === "orders" ? "nav-link active" : "nav-link"}
    onClick={() => setPage("orders")}
  >
    My Orders
  </button>
)}
          {user?.role === "farmer" && (
            <button
              className={page === "dashboard" ? "nav-link active" : "nav-link"}
              onClick={() => setPage("dashboard")}
            >
              Farmer dashboard
            </button>
          )}
          {user?.role === "farmer" && (
  <button
    className={
      page === "incoming-orders" ? "nav-link active" : "nav-link"
    }
    onClick={() => setPage("incoming-orders")}
  >
    Incoming orders
    {farmerOrders.filter((order) => order.status === "pending").length > 0 && (
      <span className="nav-count">
        {farmerOrders.filter((order) => order.status === "pending").length}
      </span>
    )}
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
                          <article
                              className="product-card"
                              key={product.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setSelectedProduct(product);
                                setOrderQuantity("1");
                                setDeliveryAddress("");
                                setBuyerNote("");
                                setError("");
                                setMessage("");
                                setPage("product");
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setSelectedProduct(product);
                                  setOrderQuantity("1");
                                  setDeliveryAddress("");
                                  setBuyerNote("");
                                  setError("");
                                  setMessage("");
                                  setPage("product");
                                }
                              }}
                            >
                      <div className={`product-visual product-visual-${index % 5}`}>
                        <span className="product-category">{product.category}</span>
                        {product.image_url ? (
                          <img
                            className="product-photo"
                            src={product.image_url}
                            alt={product.name}
                          />
                        ) : (
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
                        )}

                        <span className="product-category">{product.category}</span>
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


                        {page === "product" && selectedProduct && (
                  <section className="product-detail-section">
                    <button
                      className="button button-outline"
                      onClick={() => setPage("marketplace")}
                    >
                      ← Back to marketplace
                    </button>

                    <div className="product-detail-layout">
                      <div
                        className={`product-detail-visual product-visual-${
                          Math.max(0, products.findIndex((item) => item.id === selectedProduct.id)) % 5
                        }`}
                      >
                        {selectedProduct.image_url ? (
                          <img
                            className="product-detail-photo"
                            src={selectedProduct.image_url}
                            alt={selectedProduct.name}
                          />
                        ) : (
                          <span className="product-detail-emoji" aria-hidden="true">
                            {({
                              Vegetables: "🥬",
                              Fruits: "🍊",
                              Grains: "🌽",
                              Tubers: "🍠",
                              Poultry: "🐓",
                              Livestock: "🐐",
                            } as Record<string, string>)[selectedProduct.category] ?? "🌱"}
                          </span>
                        )}

                        <span className="product-category">{selectedProduct.category}</span>
                      </div>

                      <div className="product-detail-content">
                        <span className="eyebrow">FRESH FROM EKITI</span>
                        <h1>{selectedProduct.name}</h1>
                        <p className="product-detail-location">⌖ {selectedProduct.location}</p>

                        <div className="product-detail-price">
                          {money(selectedProduct.price_per_unit)}
                          <span> / {selectedProduct.unit}</span>
                        </div>

                        <div className="product-detail-stock">
                          <span className="available-dot" />
                          {Number(selectedProduct.quantity_available).toLocaleString()}{" "}
                          {selectedProduct.unit} available
                        </div>

                        <div className="product-detail-description">
                          <h2>About this produce</h2>
                          <p>
                            {selectedProduct.description ||
                              `Explore ${selectedProduct.name.toLowerCase()} sourced from a local farm in ${selectedProduct.location}. Contact and delivery arrangements can be discussed through your order details.`}
                          </p>
                        </div>

                        {selectedProduct.is_available &&
                        Number(selectedProduct.quantity_available) > 0 ? (
                          user?.role === "farmer" || user?.role === "admin" ? (
                            <div className="status-note">
                              Ordering is available to buyer accounts. Sign in with a buyer account to place an order.
                            </div>
                          ) : (
                            <form onSubmit={submitOrder} className="product-order-form">
                              <h2>Place your order</h2>

                              <label>
                                Quantity ({selectedProduct.unit})
                                <input
                                  type="number"
                                  min="0.01"
                                  max={Number(selectedProduct.quantity_available)}
                                  step="0.01"
                                  required
                                  value={orderQuantity}
                                  onChange={(event) => setOrderQuantity(event.target.value)}
                                />
                              </label>

                              <div className="order-total">
                                <span>Estimated total</span>
                                <strong>
                                  {money(
                                    Number(selectedProduct.price_per_unit) *
                                      Math.max(0, Number(orderQuantity) || 0),
                                  )}
                                </strong>
                              </div>

                              <label>
                                Delivery address
                                <textarea
                                  required
                                  minLength={5}
                                  maxLength={250}
                                  rows={3}
                                  value={deliveryAddress}
                                  onChange={(event) => setDeliveryAddress(event.target.value)}
                                  placeholder="Enter the address where your order should be delivered"
                                />
                              </label>

                              <label>
                                Note to the farmer (optional)
                                <textarea
                                  maxLength={2000}
                                  rows={2}
                                  value={buyerNote}
                                  onChange={(event) => setBuyerNote(event.target.value)}
                                  placeholder="Any helpful delivery or order instructions"
                                />
                              </label>

                              {!user && (
                                <p className="muted-copy">
                                  You'll need to sign in with a buyer account to place your order.
                                </p>
                              )}

                              <button
                                type="submit"
                                className="button button-primary button-full"
                                disabled={busy}
                              >
                                {busy ? "Placing order…" : "Place order"}
                              </button>
                            </form>
                          )
                        ) : (
                          <div className="status-note">
                            This product is currently out of stock.
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                )}

         {page === "orders" && user?.role === "buyer" && (
  <section className="orders-section">
    <div className="orders-heading">
      <div>
        <span className="eyebrow">YOUR PURCHASES</span>
        <h1>My Orders</h1>
        <p>Keep track of your requests and their progress.</p>
      </div>

      <button
        className="button button-outline"
        onClick={() => void loadMyOrders()}
        disabled={ordersLoading}
      >
        {ordersLoading ? "Refreshing…" : "Refresh orders ↻"}
      </button>
    </div>

    {ordersLoading ? (
      <div className="empty-state">
        <p>Loading your orders…</p>
      </div>
    ) : myOrders.length === 0 ? (
      <div className="empty-state">
        <span className="empty-icon">🧺</span>
        <h3>No orders yet</h3>
        <p>
          When you order fresh produce from the marketplace,
          your requests will appear here.
        </p>
        <button
          className="button button-primary"
          onClick={() => setPage("marketplace")}
        >
          Explore marketplace
        </button>
      </div>
    ) : (
      <div className="orders-list">
        {myOrders.map((order) => (
          <article className="order-card" key={order.id}>
            <div className="order-card-heading">
              <div>
                <span className="eyebrow">ORDER REQUEST</span>
                <h2>{order.product_name}</h2>
                <p>
                  Placed {new Date(order.created_at).toLocaleString("en-NG")}
                </p>
              </div>

              <span className={`order-status status-${order.status}`}>
                {order.status.replaceAll("_", " ")}
              </span>
            </div>

            <div className="order-information">
              <div>
                <span>Quantity</span>
                <strong>
                  {Number(order.quantity).toLocaleString()} {order.unit}
                </strong>
              </div>

              <div>
                <span>Price per unit</span>
                <strong>{money(order.unit_price)}</strong>
              </div>

              <div>
                <span>Order total</span>
                <strong>{money(order.total_price)}</strong>
              </div>
            </div>

            <div className="order-delivery">
              <strong>Delivery address</strong>
              <p>{order.delivery_address}</p>
            </div>

            {order.buyer_note && (
              <div className="order-delivery">
                <strong>Your note to the farmer</strong>
                <p>{order.buyer_note}</p>
              </div>
            )}

            {order.rejection_reason && (
              <div className="rejection-note">
                <strong>Reason for rejection</strong>
                <p>{order.rejection_reason}</p>
              </div>
            )}

            <div className="order-card-footer">
              <span>
                Last updated:{" "}
                {new Date(order.updated_at).toLocaleString("en-NG")}
              </span>

              {order.status === "pending" && (
                <button
                  className="text-button danger-text"
                  onClick={() => void cancelOrder(order)}
                  disabled={busy}
                >
                  Cancel order
                </button>
              )}

              {order.status === "ready_for_fulfillment" && (
                <button
                  className="button button-primary button-small"
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    setMessage("");

                    try {
                      await apiRequest<Order>(
                        `/orders/${order.id}/status`,
                        {
                          method: "PATCH",
                          body: JSON.stringify({ status: "completed" }),
                        },
                      );

                      setMessage("Order marked as completed.");
                      await loadMyOrders();
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Could not complete the order.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                  disabled={busy}
                >
                  Confirm completion
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    )}
  </section>
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

        {page === "incoming-orders" && user?.role === "farmer" && (
  <section className="orders-section">
    <div className="orders-heading">
      <div>
        <span className="eyebrow">FARMER WORKSPACE</span>
        <h1>Incoming orders</h1>
        <p>Review buyer requests and manage your order fulfilment.</p>
      </div>

      <button
        className="button button-outline"
        onClick={() => void loadFarmerOrders()}
        disabled={farmerOrdersLoading}
      >
        {farmerOrdersLoading ? "Refreshing…" : "Refresh orders ↻"}
      </button>
    </div>

    {farmerOrdersLoading ? (
      <div className="empty-state">
        <p>Loading incoming orders…</p>
      </div>
    ) : farmerOrders.length === 0 ? (
      <div className="empty-state">
        <span className="empty-icon">📦</span>
        <h3>No incoming orders yet</h3>
        <p>
          Orders placed for your listed products will appear here.
        </p>
        <button
          className="button button-primary"
          onClick={() => setPage("dashboard")}
        >
          Manage my products
        </button>
      </div>
    ) : (
      <div className="orders-list">
        {farmerOrders.map((order) => (
          <article className="order-card" key={order.id}>
            <div className="order-card-heading">
              <div>
                <span className="eyebrow">ORDER REQUEST</span>
                <h2>{order.product_name}</h2>
                <p>
                  Received{" "}
                  {new Date(order.created_at).toLocaleString("en-NG")}
                </p>
              </div>

              <span className={`order-status status-${order.status}`}>
                {order.status.replace(/_/g, " ")}
              </span>
            </div>

            <div className="order-information">
              <div>
                <span>Quantity requested</span>
                <strong>
                  {Number(order.quantity).toLocaleString()} {order.unit}
                </strong>
              </div>

              <div>
                <span>Price per unit</span>
                <strong>{money(order.unit_price)}</strong>
              </div>

              <div>
                <span>Order total</span>
                <strong>{money(order.total_price)}</strong>
              </div>
            </div>

            <div className="order-delivery">
              <strong>Buyer's delivery address</strong>
              <p>{order.delivery_address}</p>
            </div>

            {order.buyer_note && (
              <div className="order-delivery">
                <strong>Buyer's note</strong>
                <p>{order.buyer_note}</p>
              </div>
            )}

            {order.rejection_reason && (
              <div className="rejection-note">
                <strong>Rejection reason</strong>
                <p>{order.rejection_reason}</p>
              </div>
            )}

            {order.status === "pending" && (
              <div className="farmer-order-actions">
                {rejectingOrderId === order.id ? (
                  <form
                    className="rejection-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void updateFarmerOrderStatus(order, "rejected");
                    }}
                  >
                    <label>
                      Reason for rejecting this order
                      <textarea
                        required
                        minLength={3}
                        rows={3}
                        value={rejectionReason}
                        onChange={(event) =>
                          setRejectionReason(event.target.value)
                        }
                        placeholder="Explain why you cannot fulfil this order."
                      />
                    </label>

                    <div className="action-buttons">
                      <button
                        type="submit"
                        className="button button-danger"
                        disabled={busy || !rejectionReason.trim()}
                      >
                        {busy ? "Submitting…" : "Confirm rejection"}
                      </button>

                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => {
                          setRejectingOrderId(null);
                          setRejectionReason("");
                          setError("");
                        }}
                        disabled={busy}
                      >
                        Go back
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="action-buttons">
                    <button
                      className="button button-primary"
                      onClick={() =>
                        void updateFarmerOrderStatus(order, "accepted")
                      }
                      disabled={busy}
                    >
                      Accept order
                    </button>

                    <button
                      className="button button-outline danger-text"
                      onClick={() => {
                        setRejectingOrderId(order.id);
                        setRejectionReason("");
                        setError("");
                      }}
                      disabled={busy}
                    >
                      Reject order
                    </button>
                  </div>
                )}
              </div>
            )}

            {order.status === "accepted" && (
              <div className="farmer-order-actions">
                <p className="status-note">
                  You have accepted this order. Mark it as ready when it is
                  prepared for fulfilment.
                </p>

                <button
                  className="button button-primary"
                  onClick={() =>
                    void updateFarmerOrderStatus(
                      order,
                      "ready_for_fulfillment",
                    )
                  }
                  disabled={busy}
                >
                  Mark as ready for fulfillment
                </button>
              </div>
            )}

            {order.status === "ready_for_fulfillment" && (
              <div className="status-note">
                This order is ready for fulfilment. The buyer can confirm
                completion from their My Orders page.
              </div>
            )}

            {order.status === "completed" && (
              <div className="success-note">
                This order has been completed.
              </div>
            )}

            {order.status === "rejected" && (
              <div className="status-note">
                You rejected this order.
              </div>
            )}

            {order.status === "cancelled" && (
              <div className="status-note">
                The buyer cancelled this order.
              </div>
            )}

            <div className="order-card-footer">
              <span>
                Last updated:{" "}
                {new Date(order.updated_at).toLocaleString("en-NG")}
              </span>
            </div>
          </article>
        ))}
      </div>
    )}
  </section>
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

                      <div className="form-field">
                       <label htmlFor="product-image">Product image</label>

                          <input
                            id="product-image"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null;
                              setProductImage(file);
                            }}
                          />

                          <small>
                            Upload a clear photo of your product. Accepted formats: JPG, PNG and WebP.
                          </small>

                          {productImagePreview && (
                            <div className="image-preview">
                              <img
                                src={productImagePreview}
                                alt="Selected product preview"
                              />
                            </div>
                          )}
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
