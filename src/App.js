import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import './App.css';

function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/lobby/:code" element={<LobbyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </UserProvider>
  );
}

export default App;
