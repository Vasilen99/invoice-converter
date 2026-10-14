import { createClient } from "./supabase/server";

export async function getUserServer() {
  const supabase = await createClient();
  try {
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims();

    if (claimsData?.claims) {
      return claimsData.claims;
    }

    if (claimsError) {
      console.warn("getClaims returned error, falling back to getUser", {
        message: claimsError.message,
      });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
      console.error("Error getting user from fallback:", userError.message);
      return null;
    }

    if (!userData?.user) {
      return null;
    }

    return {
      ...userData.user,
      sub: userData.user.id,
    };
  } catch (error) {
    console.error("Error getting user:", error);
    return null;
  }
}
