require("dotenv").config();
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const { error } = await supabase.auth.signInWithOtp({
  email: "gaspar.alves@digik.pt",
});
if (error) console.error(error);
