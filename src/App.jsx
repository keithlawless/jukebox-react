import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import packageJson from '../package.json';
import { getApiVersion } from './api/jukeboxApi';
import BrowsePage from './pages/BrowsePage';
import QueuePage from './pages/QueuePage';
import RadioPage from './pages/RadioPage';
import SearchPage from './pages/SearchPage';

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
            <NavLink to="/queue" className={({ isActive }) => (isActive ? 'active' : '')}>
              Queue
            </NavLink>
            <NavLink to="/browse" className={({ isActive }) => (isActive ? 'active' : '')}>
              Browse
            </NavLink>
            <NavLink to="/radio" className={({ isActive }) => (isActive ? 'active' : '')}>
              Radio
            </NavLink>
            <NavLink to="/search" className={({ isActive }) => (isActive ? 'active' : '')}>
              Search
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
          <Route path="/" element={<Navigate to="/queue" replace />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/radio" element={<RadioPage />} />
          <Route path="/search" element={<SearchPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
