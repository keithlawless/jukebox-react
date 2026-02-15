import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import packageJson from '../package.json';
import { getApiVersion } from './api/jubeboxApi';
import BrowsePage from './pages/BrowsePage';
import QueuePage from './pages/QueuePage';

function App() {
  const [apiVersion, setApiVersion] = useState('loading...');

  useEffect(() => {
    let isMounted = true;

    getApiVersion()
      .then((version) => {
        if (isMounted) {
          setApiVersion(version || 'unknown');
        }
      })
      .catch(() => {
        if (isMounted) {
          setApiVersion('unavailable');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="app-shell">
      <header className="top-nav">
        <h1>Jukebox</h1>
        <div className="top-nav-meta">
          <nav>
            <NavLink to="/browse" className={({ isActive }) => (isActive ? 'active' : '')}>
              Browse
            </NavLink>
            <NavLink to="/queue" className={({ isActive }) => (isActive ? 'active' : '')}>
              Queue
            </NavLink>
          </nav>
          <div className="version-badges">
            <span>UI {packageJson.version}</span>
            <span>API {apiVersion}</span>
          </div>
        </div>
      </header>

      <main className="page-content">
        <Routes>
          <Route path="/" element={<Navigate to="/browse" replace />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/queue" element={<QueuePage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
