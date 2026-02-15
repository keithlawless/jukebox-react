import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import BrowsePage from './pages/BrowsePage';
import QueuePage from './pages/QueuePage';

function App() {
  return (
    <div className="app-shell">
      <header className="top-nav">
        <h1>Jukebox</h1>
        <nav>
          <NavLink to="/browse" className={({ isActive }) => (isActive ? 'active' : '')}>
            Browse
          </NavLink>
          <NavLink to="/queue" className={({ isActive }) => (isActive ? 'active' : '')}>
            Queue
          </NavLink>
        </nav>
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
