import { Suspense } from 'react';
import { LoginForm } from '@/components/LoginForm/LoginForm';

export const metadata = { title: 'Sign in · Fydr' };

export default function LoginPage() {
  return (
    <main className="login-wrap" id="main">
      <div className="login-card">
        <div className="brand" style={{ padding: '0 0 20px' }}>
          <div className="wm">
            Fydr<i>.</i>
          </div>
        </div>
        <div className="card">
          <h1 className="card-title" style={{ fontSize: 18 }}>
            Sign in
          </h1>
          <p className="import-sub">
            Accounts are created by your club. There is no self sign-up.
          </p>
          <Suspense fallback={<p className="tiny">Loading the form.</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
