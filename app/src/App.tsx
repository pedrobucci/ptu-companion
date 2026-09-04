import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import TrainerList from "./pages/TrainerList";
import TrainerSheet from "./pages/TrainerSheet";
import Pokedex from "./pages/Pokedex";
import Editor from "./pages/Editor";
import Settings from "./pages/Settings";
import "./App.css";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "nav-link nav-link-active" : "nav-link";

function App() {
  return (
    <HashRouter>
      <div className="app-shell">
        <nav className="app-nav" aria-label="Main navigation">
          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
          <NavLink to="/trainer" className={navLinkClass}>
            Trainer
          </NavLink>
          <NavLink to="/pokedex" className={navLinkClass}>
            Pokédex
          </NavLink>
          <NavLink to="/editor" className={navLinkClass}>
            Editor
          </NavLink>
          <NavLink to="/settings" className={navLinkClass}>
            Settings
          </NavLink>
        </nav>
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/trainer" element={<TrainerList />} />
            <Route path="/trainer/:trainerId" element={<TrainerSheet />} />
            <Route path="/pokedex" element={<Pokedex />} />
            <Route path="/editor" element={<Editor />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

export default App;
