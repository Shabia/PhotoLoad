import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import RedirectToApp from "./redirect-client";

type Props = { params: Promise<{ id: string }> };

function getBaseUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  return "http://localhost:3000";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: photo } = await supabase
    .from("photos")
    .select("id")
    .eq("id", id)
    .single();
  const base = getBaseUrl();
  const imageUrl = photo ? `${base}/api/og-photo/${id}` : undefined;
  return {
    title: "Photo on PhotoLoad",
    description: "Check out this photo on PhotoLoad",
    openGraph: {
      title: "Photo on PhotoLoad",
      description: "Check out this photo on PhotoLoad",
      images: imageUrl ? [{ url: imageUrl, width: 1200, height: 630 }] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Photo on PhotoLoad",
      description: "Check out this photo on PhotoLoad",
      images: imageUrl ? [imageUrl] : [],
    },
  };
}

export default async function FitPhotoPage({ params }: Props) {
  const { id } = await params;
  return <RedirectToApp photoId={id} />;
}
