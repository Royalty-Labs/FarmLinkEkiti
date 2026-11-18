import { NavLink, Outlet } from "react-router";
import { RequireRole } from "../auth/RequireRole";
import { Icon, type IconName } from "../components/Icon";

type NavItem = { to: string; label: string; icon: IconName; end?: boolean };

function BottomNav({ items, label }: { items: NavItem[]; label: string }) {
  return (
    <nav className="bottom-nav" aria-label={label}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `bottom-nav__item${isActive ? " is-active" : ""}`}
        >
          <Icon name={item.icon} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

const BUYER_NAV: NavItem[] = [
  { to: "/shop", label: "Shop", icon: "shop" },
  { to: "/orders", label: "Orders", icon: "receipt" },
  { to: "/account", label: "Account", icon: "user" },
];

const FARMER_NAV: NavItem[] = [
  { to: "/farm", label: "Overview", icon: "chart", end: true },
  { to: "/farm/orders", label: "Orders", icon: "receipt" },
  { to: "/farm/listings", label: "Listings", icon: "listings" },
  { to: "/farm/profile", label: "Farm", icon: "farm" },
];

/** Public screens (welcome, sign in) in the phone-width column. */
export function PlainShell() {
  return (
    <div className="app-shell">
      <Outlet />
    </div>
  );
}

/** Marketplace browsing works signed out; orders and account need a buyer. */
export function BuyerShell() {
  return (
    <div className="app-shell app-shell--nav">
      <Outlet />
      <BottomNav items={BUYER_NAV} label="Main" />
    </div>
  );
}

export function FarmerShell() {
  return (
    <RequireRole role="farmer">
      <div className="app-shell app-shell--nav">
        <Outlet />
        <BottomNav items={FARMER_NAV} label="Farmer" />
      </div>
    </RequireRole>
  );
}
