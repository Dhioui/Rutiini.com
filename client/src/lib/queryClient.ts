import { QueryClient, QueryFunction, MutationCache } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import i18n from "@/i18n";
import { apiUrl } from "@/lib/api";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<any> {
  const headers = {
    ...getAuthHeaders(),
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  const res = await fetch(apiUrl(url), {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return await res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers = getAuthHeaders();

    const res = await fetch(apiUrl(queryKey.join("/") as string), {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * Turn a thrown request error into something a person can act on.
 *
 * Errors arrive as "<status>: <body>", where the body is normally the API's JSON
 * error object. Showing that raw string would put `403: {"error":"Unauthorized"}`
 * in front of a daycare worker, so the message is unwrapped and the common status
 * codes get a translated explanation instead.
 */
function describeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const match = /^(\d{3}): ([\s\S]*)$/.exec(raw);

  if (!match) {
    // No status: the request never reached the server.
    return i18n.t('networkError', { defaultValue: raw });
  }

  const status = Number(match[1]);
  let detail = match[2].trim();
  try {
    const parsed = JSON.parse(detail);
    if (parsed && typeof parsed.error === 'string') detail = parsed.error;
    else if (parsed && typeof parsed.message === 'string') detail = parsed.message;
  } catch {
    // Not JSON; keep the text as it came.
  }

  if (status === 401) return i18n.t('sessionExpired', { defaultValue: detail });
  if (status === 403) return i18n.t('accessDenied', { defaultValue: detail });
  if (status >= 500) return i18n.t('serverError', { defaultValue: detail });
  return detail;
}

export const queryClient = new QueryClient({
  // Every mutation reports its failures.
  //
  // Ten of the write actions -- reporting an absence, sending a message, adding a
  // child, creating a trip -- had no onError of their own, so a rejected request
  // did nothing at all: the dialog stayed open, no message appeared, and the user
  // had no way to tell whether the save had worked. This is the fallback for all of
  // them, and for any mutation added later.
  //
  // A mutation that handles its own errors already shows a message tailored to what
  // it was doing, so this stays quiet rather than stacking a second toast on top.
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.onError) return;
      toast({
        title: i18n.t('error'),
        description: describeError(error),
        variant: 'destructive',
      });
    },
  }),
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
