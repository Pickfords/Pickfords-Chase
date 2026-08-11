import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import PlayerView from './pages/PlayerView';
import AdminView from './pages/AdminView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play/contestant" element={<PlayerView role="contestant" />} />
        <Route path="/play/contestant/:code" element={<PlayerView role="contestant" />} />
        <Route path="/play/chaser" element={<PlayerView role="chaser" />} />
        <Route path="/play/chaser/:code" element={<PlayerView role="chaser" />} />
        <Route path="/admin" element={<AdminView />} />
      </Routes>
    </BrowserRouter>
  );
}
