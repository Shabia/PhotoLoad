import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Serves the photo image for Open Graph / WhatsApp preview.
 * Proxies the image bytes so crawlers get a direct 200 response (WhatsApp often ignores redirects for og:image).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const supabase = createAdminClient();
  const { data: photo, error: selectError } = await supabase
    .from("photos")
    .select("path")
    .eq("id", id)
    .single();
  if (selectError || !photo?.path) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
  const { data: signed } = await supabase.storage
    .from("photos")
    .createSignedUrl(photo.path, 3600);
  if (!signed?.signedUrl) {
    return NextResponse.json({ error: "Could not get image" }, { status: 502 });
  }
  const imageRes = await fetch(signed.signedUrl, { cache: "no-store" });
  if (!imageRes.ok) {
    return NextResponse.json({ error: "Could not fetch image" }, { status: 502 });
  }
  const contentType = imageRes.headers.get("content-type") || "image/jpeg";
  const blob = await imageRes.blob();
  return new NextResponse(blob, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
