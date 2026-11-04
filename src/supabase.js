
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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

export const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey)
  : createDemoSupabaseClient();
