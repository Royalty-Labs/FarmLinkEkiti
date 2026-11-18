import { useCallback, useState } from "react";
import * as api from "../../api/endpoints";
import { EmptyState, Notice, PageLoader } from "../../components/Feedback";
import { FarmerOrderCard } from "../../components/FarmerOrderCard";
import { ACTIVE_ORDER_STATUSES } from "../../lib/format";
import { useApi } from "../../lib/useApi";

export default function FarmerOrders() {
  const [tab, setTab] = useState<"open" | "done">("open");
  const load = useCallback(() => api.listFarmerOrders(), []);
  const { data, error, loading, reload } = useApi(load);

  const open = data?.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status)) ?? [];
  const done = data?.filter((o) => !ACTIVE_ORDER_STATUSES.includes(o.status)) ?? [];
  const shown = tab === "open" ? open : done;

  return (
    <>
      <header className="ink-header">
        <h1 className="ink-header__heading">Orders</h1>
        <div className="segmented segmented--dark" role="tablist" aria-label="Order filter">
          <button role="tab" aria-selected={tab === "open"} className={`segmented__option${tab === "open" ? " is-active" : ""}`} onClick={() => setTab("open")}>
            Open{open.length ? ` · ${open.length}` : ""}
          </button>
          <button role="tab" aria-selected={tab === "done"} className={`segmented__option${tab === "done" ? " is-active" : ""}`} onClick={() => setTab("done")}>
            Finished
          </button>
        </div>
      </header>
      <main className="page">
        {error && <Notice tone="error">{error}</Notice>}
        {loading && !data ? (
          <PageLoader label="Loading orders" />
        ) : shown.length === 0 ? (
          <EmptyState
            title={tab === "open" ? "No open orders" : "No finished orders yet"}
            body={tab === "open" ? "New orders from buyers will appear here." : undefined}
          />
        ) : (
          <div className="stack">
            {shown.map((order) => (
              <FarmerOrderCard key={order.id} order={order} onChanged={reload} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
