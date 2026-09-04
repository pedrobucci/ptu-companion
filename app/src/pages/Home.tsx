import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";

export default function Home() {
  const [domainStatus, setDomainStatus] = useState<string>("checking...");

  useEffect(() => {
    invoke<string>("domain_status")
      .then(setDomainStatus)
      .catch((err) => setDomainStatus(`error: ${String(err)}`));
  }, []);

  return (
    <section>
      <h1>PTU Companion</h1>
      <p>Offline-first Trainer/Pokémon companion for Pokémon Tabletop United.</p>
      <p>Domain layer: {domainStatus}</p>
      <p>
        <Link to="/trainer">Open your Trainers →</Link>
      </p>
    </section>
  );
}
