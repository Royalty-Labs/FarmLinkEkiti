import { useCallback, useState } from "react";
import { Link } from "react-router";
import * as api from "../../api/endpoints";
import { useAuth } from "../../auth/useAuth";
import { EmptyState, Notice, PageLoader } from "../../components/Feedback";
import { FarmerOrderCard } from "../../components/FarmerOrderCard";
import { Icon, VerifiedMark } from "../../components/Icon";
import { naira, toDate } from "../../lib/format";
import { useApi } from "../../lib/useApi";
import type { FarmerProfile } from "../../types";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const LOW_STOCK = 5;

function ProfileStatus({ profile }: { profile: FarmerProfile | null }) {
  if (!profile) return <span className="ink-header__eyebrow">Farm not set up yet</span>;
  if (profile.verification_status === "approved") {
    return (
      <span className="ink-header__status">
        <VerifiedMark size={14} onDark /> Verified seller
      </span>
    );
  }
  if (profile.verification_status === "pending") {
    return <span className="ink-header__status ink-header__status--amber">Waiting for verification</span>;
  }
  return <span className="ink-header__status ink-header__status--amber">Changes needed</span>;
}

export default function Overview() {
  const { user } = useAuth();
  const loadProfile = useCallback(() => api.getMyProfile(), []);
  const loadOrders = useCallback(() => api.listFarmerOrders(), []);
  const loadProducts = useCallback(() => api.listMyProducts(), []);
  const profile = useApi(loadProfile);
  const orders = useApi(loadOrders);
  const products = useApi(loadProducts);
  // Fixed when the screen opens, so the weekly figure doesn't shift between renders.
  const [now] = useState(() => Date.now());

  if (profile.loading && profile.data === undefined) return <PageLoader />;

  const farm = profile.data ?? null;
  const approved = farm?.verification_status === "approved";
  const allOrders = orders.data ?? [];
  const completedThisWeek = allOrders.filter(
    (o) => o.status === "completed" && now - toDate(o.updated_at).getTime() < WEEK_MS,
  );
  const weekSales = completedThisWeek.reduce((sum, o) => sum + Number(o.total_price), 0);
  const pending = allOrders.filter((o) => o.status === "pending");
  const toPack = allOrders.filter((o) => o.status === "accepted");
  const live = (products.data ?? []).filter((p) => p.is_available && Number(p.quantity_available) > 0);
  const low = live.filter((p) => Number(p.quantity_available) <= LOW_STOCK);

  return (
    <>
      <header className="ink-header ink-header--tall">
        <div className="ink-header__row">
          <div className="ink-header__place">
            <span className="ink-header__eyebrow">{farm?.farm_name ?? user?.full_name}</span>
            <ProfileStatus profile={farm} />
          </div>
          {approved && (
            <Link to="/farm/listings/new" className="btn btn--lime btn--sm">
              <Icon name="plus" size={16} strokeWidth={2.4} /> New listing
            </Link>
          )}
        </div>

        <div className="kpi">
          <span className="kpi__label">Sales this week</span>
          <span className="kpi__value">{naira(weekSales)}</span>
          <span className="kpi__label">
            {completedThisWeek.length
              ? `From ${completedThisWeek.length} completed order${completedThisWeek.length === 1 ? "" : "s"}`
              : "No completed orders this week yet"}
          </span>
        </div>

        <div className="metrics">
          <div className="metrics__item">
            <span className="metrics__value">{pending.length}</span>
            <span className="metrics__label">New orders</span>
          </div>
          <div className="metrics__item">
            <span className="metrics__value">{live.length}</span>
            <span className="metrics__label">Live listings</span>
          </div>
          <div className="metrics__item">
            <span className={`metrics__value${low.length ? " metrics__value--amber" : ""}`}>{low.length}</span>
            <span className="metrics__label">Running low</span>
          </div>
        </div>
      </header>

      <main className="page">
        {(orders.error || products.error || profile.error) && (
          <Notice tone="error">{orders.error ?? products.error ?? profile.error}</Notice>
        )}

        {!farm && (
          <EmptyState
            title="Set up your farm to start selling"
            body="Tell buyers who you are and where you farm. We check every farm before its produce goes live."
            action={<Link to="/farm/profile" className="btn btn--ink">Set up my farm</Link>}
          />
        )}
        {farm?.verification_status === "pending" && (
          <Notice tone="warning">
            We're checking your farm details. You can list produce as soon as you're verified.
          </Notice>
        )}
        {farm?.verification_status === "rejected" && (
          <Notice tone="error">
            Your farm needs changes: {farm.rejection_reason}{" "}
            <Link to="/farm/profile">Update your farm details</Link>
          </Notice>
        )}

        {farm && (
          <>
            <section className="section">
              <div className="section__head">
                <h2 className="section__title">Needs your answer</h2>
                <Link to="/farm/orders" className="section__link">All orders</Link>
              </div>
              {pending.length === 0 ? (
                <p className="muted">No new orders right now.</p>
              ) : (
                <div className="stack">
                  {pending.map((order) => (
                    <FarmerOrderCard key={order.id} order={order} onChanged={() => { orders.reload(); products.reload(); }} />
                  ))}
                </div>
              )}
            </section>

            {toPack.length > 0 && (
              <section className="section">
                <h2 className="section__title">To pack</h2>
                <div className="stack">
                  {toPack.map((order) => (
                    <FarmerOrderCard key={order.id} order={order} onChanged={orders.reload} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
