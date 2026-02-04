import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser();

  if (sessionError || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const userId = user.id;
  const admin = createAdminClient();

  try {
    // 1. List and delete all storage files in the user's folder
    const { data: files } = await admin.storage.from("photos").list(userId);
    if (files?.length) {
      const paths = files
        .filter((f) => f.name)
        .map((f) => `${userId}/${f.name}`);
      if (paths.length) {
        await admin.storage.from("photos").remove(paths);
      }
    }

    // 2. Delete photo rows (RLS would allow this for own user, but admin is consistent)
    await admin.from("photos").delete().eq("user_id", userId);

    // 3. Delete the auth user
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Delete user error:", deleteError);
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete account error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
