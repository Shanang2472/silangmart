const originalFetch = window.fetch;
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

export function resolveApiUrl(url: string): string {
  if (!apiBaseUrl || !/^\/api(?:\/|$)/.test(url)) return url;
  return `${apiBaseUrl}${url}`;
}

export function setupFetchInterceptor() {
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlString = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const isApiCall = /\/api(?:\/|$)/.test(urlString);
    const isAuthLoginOrRegister = /\/api\/auth\/(?:login|register)(?:[/?#]|$)/.test(urlString);
    const requestInput = typeof input === 'string' ? resolveApiUrl(input) : input;

    let modifiedInit = init;
    if (isApiCall && !isAuthLoginOrRegister) {
      const token = localStorage.getItem('silang_auth_token');
      if (token) {
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
          modifiedInit = { ...init, headers };
        }
      }
    }

    const response = await originalFetch.call(window, requestInput, modifiedInit);

    if (response.status === 401 && isApiCall && !isAuthLoginOrRegister) {
      const hadSession = localStorage.getItem('silang_auth_token') || localStorage.getItem('silang_logged_in_user');
      if (hadSession) {
        console.warn(`[FetchInterceptor] 401 received from ${urlString} — clearing session.`);
        localStorage.removeItem('silang_auth_token');
        localStorage.removeItem('silang_logged_in_user');
        window.dispatchEvent(new CustomEvent('auth:unauthorized', {
          detail: { url: urlString, status: 401 }
        }));
      }
    }

    return response;
  };
}
