import { Link, Navigate } from "react-router";
import { homePathFor } from "../auth/authContext";
import { useAuth } from "../auth/useAuth";
import { Icon } from "../components/Icon";
import { Logo } from "../components/Logo";
import { PageLoader } from "../components/Feedback";

export default function Welcome() {
  const { user, ready } = useAuth();

  if (!ready) return <PageLoader />;
  if (user) return <Navigate to={homePathFor(user.role)} replace />;

  return (
    <main className="welcome">
      <Logo />

      <div className="welcome__intro">
        <span className="welcome__place">
          <span className="dot dot--lime" aria-hidden="true" />
          Now in Ado-Ekiti
        </span>
        <h1 className="welcome__title">Fresh food, straight from Ekiti farmers.</h1>
        <p className="welcome__lead">
          Buy directly from verified farmers, or sell your harvest to buyers near you.
        </p>
      </div>

      <div className="welcome__choices">
        <Link to="/shop" className="choice choice--lime">
          <span className="choice__text">
            <span className="choice__title">I'm buying food</span>
            <span className="choice__sub">Shop produce from verified farms</span>
          </span>
          <Icon name="arrowRight" size={20} strokeWidth={2} />
        </Link>
        <Link to="/register?role=farmer" className="choice">
          <span className="choice__text">
            <span className="choice__title">I'm a farmer</span>
            <span className="choice__sub">Sell your harvest to buyers nearby</span>
          </span>
          <Icon name="arrowRight" size={20} strokeWidth={2} />
        </Link>
        <p className="welcome__signin">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
