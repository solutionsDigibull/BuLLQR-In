import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';

interface FieldErrors {
  username?: string;
  password?: string;
}

function validate(username: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  const trimmedUser = username.trim();

  if (!trimmedUser) {
    errors.username = 'Username is required';
  } else if (trimmedUser.length < 3) {
    errors.username = 'Username must be at least 3 characters';
  }

  if (!password) {
    errors.password = 'Password is required';
  } else if (password.length < 4) {
    errors.password = 'Password must be at least 4 characters';
  }

  return errors;
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [serverError, setServerError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<{ username?: boolean; password?: boolean }>({});
  const [submitting, setSubmitting] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const usernameRef = useRef<HTMLInputElement>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/scan';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  function handleBlur(field: 'username' | 'password') {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setFieldErrors(validate(username, password));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError('');

    const errors = validate(username, password);
    setFieldErrors(errors);
    setTouched({ username: true, password: true });

    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await login({ username: username.trim(), password });
      navigate(from, { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (isAuthenticated) return null;

  const hasErrors = Object.keys(validate(username, password)).length > 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <img src="/bullmqr-logo.png" alt="BuLLMQR" className="h-14 mx-auto" />
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {serverError && (
            <div className="bg-red-50 text-danger text-sm p-3 rounded-md border border-red-200" role="alert">
              {serverError}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Username
            </label>
            <input
              ref={usernameRef}
              id="username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (touched.username) setFieldErrors(validate(e.target.value, password));
              }}
              onBlur={() => handleBlur('username')}
              aria-invalid={touched.username && !!fieldErrors.username}
              aria-describedby={fieldErrors.username ? 'username-error' : undefined}
              className={`w-full px-4 py-3 text-base border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 ${
                touched.username && fieldErrors.username
                  ? 'border-danger'
                  : 'border-gray-300'
              }`}
              placeholder="Enter username"
            />
            {touched.username && fieldErrors.username && (
              <p id="username-error" className="mt-1 text-sm text-danger">{fieldErrors.username}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (touched.password) setFieldErrors(validate(username, e.target.value));
              }}
              onBlur={() => handleBlur('password')}
              aria-invalid={touched.password && !!fieldErrors.password}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              className={`w-full px-4 py-3 text-base border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 ${
                touched.password && fieldErrors.password
                  ? 'border-danger'
                  : 'border-gray-300'
              }`}
              placeholder="Enter password"
            />
            {touched.password && fieldErrors.password && (
              <p id="password-error" className="mt-1 text-sm text-danger">{fieldErrors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || hasErrors}
            className="w-full bg-primary text-white py-3.5 rounded-md text-lg font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
