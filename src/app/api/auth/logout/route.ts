export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utility/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return NextResponse.json(
      { data: true },
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      {
        data: false,
        alert: {
          status: "error",
          header: "Сървърна грешка",
          message: "Възникна грешка при излизане от профила.",
        },
      },
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
}
