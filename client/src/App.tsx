import { useEffect, useState } from "react";
import { checkHealth } from "./services/healthService";

function App() {
  const [status, setStatus] = useState<string>("checking...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkHealth()
      .then((res) => setStatus(res.data.status))
      .catch(() => setError("Could not reach the server"));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">CareerPilot</h1>
        {error ? (
          <p className="text-red-400">{error}</p>
        ) : (
          <p className="text-green-400">Server status: {status}</p>
        )}
      </div>
    </div>
  );
}

export default App;