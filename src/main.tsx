import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AdminDashboard } from './pages/AdminDashboard.tsx'

function AuthInterceptor({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      // Don't intercept external API calls if any, but fine for now since all are relative or localhost
      if (typeof input === 'string' && (input.startsWith('/') || input.includes('localhost') || input.includes(window.location.hostname))) {
        const token = localStorage.getItem('token');
        if (token) {
          init = init || {};
          init.headers = {
            ...init.headers,
            Authorization: `Bearer ${token}`
          };
        }
      }
      return originalFetch(input, init);
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthInterceptor>
      <BrowserRouter>
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </AuthInterceptor>
  </StrictMode>,
)
