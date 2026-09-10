const API_URL = import.meta.env.VITE_API_URL;

export interface HealthResponse {
  success: boolean;
  data: {
    status: string;
    timestamp: string;
  };
}

export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_URL}/api/health`);
  if (!response.ok) {
    throw new Error("Health check failed");
  }
  return response.json();
}