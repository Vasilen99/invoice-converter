import { createClient } from "./supabase/server";

export async function getUserServer() {
  const supabase = await createClient();
  try {
    const { data } = await supabase.auth.getClaims();
    return data?.claims || null;
  } catch (error) {
    console.error("Error getting user:", error);
    return null;
  }
}
