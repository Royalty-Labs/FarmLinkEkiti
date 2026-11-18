const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8001"
).replace(/\/$/, "");

export function getToken(): string | null {
  return localStorage.getItem("farmlink_access_token");
}

export function saveToken(token: string): void {
  localStorage.setItem("farmlink_access_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("farmlink_access_token");
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);

  if (
  options.body &&
  !(options.body instanceof FormData) &&
  !headers.has("Content-Type")
) {
  headers.set("Content-Type", "application/json");
}

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const data = await response.json();
      message =
        typeof data.detail === "string"
          ? data.detail
          : Array.isArray(data.detail)
            ? data.detail.map((item: { msg?: string }) => item.msg).join(", ")
            : message;
    } catch {
      // Keep the fallback message when the response isn't JSON.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function uploadProductImage(
  productId: string,
  file: File,
): Promise<{ image_url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest<{ image_url: string }>(
    `/products/${productId}/image`,
    {
      method: "POST",
      body: formData,
    },
  );
}
