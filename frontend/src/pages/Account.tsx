import { useNavigate } from "react-router";
import { useAuth } from "../auth/useAuth";
import { Icon } from "../components/Icon";

export default function Account() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <>
      <header className="ink-header">
        <h1 className="ink-header__heading">Account</h1>
      </header>
      <main className="page">
        <dl className="details">
          <div>
            <dt>Name</dt>
            <dd className="details__strong">{user.full_name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Account type</dt>
            <dd className="capitalize">{user.role}</dd>
          </div>
        </dl>
        <button
          className="btn btn--outline btn--block"
          onClick={() => {
            signOut();
            navigate("/", { replace: true });
          }}
        >
          <Icon name="logout" size={18} />
          Sign out
        </button>
      </main>
    </>
  );
}
