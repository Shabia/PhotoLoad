"use client";

import { useEffect } from "react";

export default function RedirectToApp({ photoId }: { photoId: string }) {
  useEffect(() => {
    const target = `/?photo=${encodeURIComponent(photoId)}`;
    window.location.replace(target);
  }, [photoId]);
  return (
    <div style={{ padding: 24, textAlign: "center", fontFamily: "system-ui" }}>
      Opening photo…
    </div>
  );
}
