
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabaseProjectHost = supabaseUrl ? new URL(supabaseUrl).hostname : "missing";

const getSafeStorage = () => {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const storage = window.localStorage;
    const testKey = "teenflow-storage-test";
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return storage;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[supabase] localStorage unavailable or blocked", {
        message: error?.message ?? null,
        host: window.location.hostname,
      });
    }
    return undefined;
  }
};

const createDemoSupabaseClient = () => {
  const emptyResult = (data = null) => ({ data, error: null });

  const chainableQuery = {
    eq: () => chainableQuery,
    order: () => chainableQuery,
    limit: () => chainableQuery,
    maybeSingle: async () => emptyResult(null),
    single: async () => emptyResult(null),
    select: async () => emptyResult([]),
    insert: async () => emptyResult(null),
    update: async () => emptyResult(null),
    delete: async () => emptyResult(null),
  };

  return {
    auth: {
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe() {},
          },
        },
      }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signUp: async () => ({ data: { session: null, user: null }, error: null }),
      signInWithPassword: async () => ({ data: { session: null, user: null }, error: null }),
      signOut: async () => ({ error: null }),
      resend: async () => ({ data: {}, error: null }),
    },
    from: () => chainableQuery,
    functions: {
      invoke: async () => emptyResult(null),
    },
    storage: {
      from: () => ({
        upload: async () => emptyResult(null),
        remove: async () => emptyResult(null),
        getPublicUrl: () => "",
      }),
    },
    rpc: async () => emptyResult(null),
  };
};

const storage = getSafeStorage();

export const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage,
      },
    })
  : createDemoSupabaseClient();

if (import.meta.env.DEV) {
  console.info("[supabase] initialized", {
    host: supabaseProjectHost,
    isLocal: window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1",
    origin: window.location.origin,
    storageAvailable: Boolean(storage),
    persistSession: true,
    autoRefreshToken: true,
  });
}
