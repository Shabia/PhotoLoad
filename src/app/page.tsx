 "use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type View =
  | "signup"
  | "signin"
  | "gallery"
  | "upload"
  | "viewPhoto"
  | "settings";

type Photo = {
  id: string;
  user_id: string;
  path: string;
  filename: string | null;
  created_at: string;
};

type UploadingFile = { file: File; progress: number; error?: string };

function HomeContent() {
  const [view, setView] = useState<View>("signup");
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [copyLinkFeedback, setCopyLinkFeedback] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [supabase] = useState(() => createClient());
  const searchParams = useSearchParams();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) setView("gallery");
      setAuthLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) setView("gallery");
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
      },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setView("signup");
  }

  async function deleteAccount() {
    if (!user) return;
    setDeleteAccountLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/delete-account", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data?.error ?? "Delete failed");
        setDeleteAccountLoading(false);
        return;
      }
      setShowDeleteConfirm(false);
      await supabase.auth.signOut();
      setView("signup");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteAccountLoading(false);
    }
  }

  async function fetchPhotos() {
    if (!user) return;
    const { data } = await supabase
      .from("photos")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setPhotos((data ?? []) as Photo[]);
  }

  useEffect(() => {
    if (user && (view === "gallery" || view === "upload")) fetchPhotos();
  }, [user, view]);

  useEffect(() => {
    if (photos.length === 0) {
      setPhotoUrls({});
      return;
    }
    (async () => {
      const urls: Record<string, string> = {};
      for (const p of photos) {
        const { data } = await supabase.storage
          .from("photos")
          .createSignedUrl(p.path, 3600);
        if (data?.signedUrl) urls[p.id] = data.signedUrl;
      }
      setPhotoUrls(urls);
    })();
  }, [photos]);

  // Open photo from shared link ?photo=id
  useEffect(() => {
    const photoId = searchParams.get("photo");
    if (!photoId || photos.length === 0) return;
    const photo = photos.find((p) => p.id === photoId);
    if (photo) {
      setSelectedPhoto(photo);
      setView("viewPhoto");
    }
  }, [searchParams, photos]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    console.log("[PhotoLoad] handleFileSelect", files?.length ?? 0, "files", user ? "signed in" : "not signed in");
    if (!files?.length) {
      return;
    }
    if (!user) {
      setUploadError("Please sign in first.");
      return;
    }
    setUploadError(null);
    // Build list first; clearing the input can clear e.target.files in some browsers
    const list: UploadingFile[] = Array.from(files).map((f) => ({
      file: f,
      progress: 0,
    }));
    e.target.value = "";
    setUploadingFiles(list);
    // Let the UI update to show the uploading row before we block on the upload
    await new Promise((r) => setTimeout(r, 100));
    console.log("[PhotoLoad] Starting upload of", list.length, "file(s)");
    let hadError = false;
    for (let i = 0; i < list.length; i++) {
      const { file } = list[i];
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      console.log("[PhotoLoad] Uploading to storage:", path);
      const storageRes = await supabase.storage.from("photos").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      console.log("[PhotoLoad] Storage result:", storageRes.error ? "ERROR " + storageRes.error.message : "OK");
      if (storageRes.error) {
        hadError = true;
        console.error("Storage upload error:", storageRes.error);
        const msg = storageRes.error.message;
        const hint = msg.toLowerCase().includes("bucket") || msg.toLowerCase().includes("not found")
          ? " Create the bucket in Supabase: Storage → New bucket → name: photos, Private → Create. Then run the 4 storage policies from supabase-setup.sql in SQL Editor."
          : "";
        setUploadError(msg + hint);
        setUploadingFiles((prev) =>
          prev.map((u) =>
            u.file === file ? { ...u, progress: 0, error: msg ?? "Upload failed" } : u
          )
        );
        continue;
      }
      console.log("[PhotoLoad] Saving to photos table...");
      const insertRes = await supabase.from("photos").insert({
        user_id: user.id,
        path,
        filename: file.name,
      });
      console.log("[PhotoLoad] Insert result:", insertRes.error ? "ERROR " + insertRes.error.message : "OK");
      if (insertRes.error) {
        hadError = true;
        console.error("Photos insert error:", insertRes.error);
        setUploadError(insertRes.error.message);
        setUploadingFiles((prev) =>
          prev.map((u) =>
            u.file === file ? { ...u, progress: 0, error: insertRes.error?.message ?? "Save failed" } : u
          )
        );
        continue;
      }
      setUploadingFiles((prev) =>
        prev.map((u) =>
          u.file === file ? { ...u, progress: 100 } : u
        )
      );
    }
    await fetchPhotos();
    if (!hadError) {
      setUploadingFiles([]);
      setView("gallery");
    }
  }

  async function deletePhoto(photo: Photo) {
    if (!user) return;
    await supabase.storage.from("photos").remove([photo.path]);
    await supabase.from("photos").delete().eq("id", photo.id).eq("user_id", user.id);
    setSelectedPhoto(null);
    setView("gallery");
    fetchPhotos();
  }

  return (
    <div className="photoload-shell">
      <header className="photoload-header">
        <div className="photoload-logo">PhotoLoad</div>

        <nav className="photoload-nav">
          <button
            className={`photoload-nav-button ${
              view === "signup" || view === "signin" ? "active" : ""
            }`}
            onClick={() => setView("signup")}
          >
            Home
          </button>
          <button
            className={`photoload-nav-button ${
              view === "gallery" || view === "viewPhoto" ? "active" : ""
            }`}
            onClick={() => setView("gallery")}
          >
            Gallery
          </button>
          <button
            className={`photoload-nav-button ${
              view === "upload" ? "active" : ""
            }`}
            onClick={() => setView("upload")}
            >
            Upload
          </button>
          <button
            className={`photoload-nav-button ${
              view === "settings" ? "active" : ""
            }`}
            onClick={() => setView("settings")}
          >
            Settings
          </button>
        </nav>
      </header>

      <main className="photoload-main">
        <div className="photoload-panel">
          {view === "signup" && (
            <>
              <h1 className="photoload-title">Signup.</h1>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
                <button
                  className="photoload-primary-button"
                  onClick={signInWithGoogle}
                  disabled={authLoading}
                >
                  Sign up with Google
                </button>
                <p style={{ marginTop: 32, fontSize: 14 }}>
                  Have an account,{" "}
                  <button
                    style={{
                      border: "none",
                      padding: 0,
                      margin: 0,
                      background: "none",
                      color: "#0b5bd3",
                      cursor: "pointer",
                    }}
                    onClick={() => setView("signin")}
                  >
                    sign in
                  </button>
                  .
                </p>
              </div>
            </>
          )}

          {view === "signin" && (
            <>
              <h1 className="photoload-title">Sign In.</h1>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
                <button
                  className="photoload-primary-button"
                  onClick={signInWithGoogle}
                  disabled={authLoading}
                >
                  Sign in with Google
                </button>
                <p style={{ marginTop: 32, fontSize: 14 }}>
                  Don&apos;t have an account,{" "}
                  <button
                    style={{
                      border: "none",
                      padding: 0,
                      margin: 0,
                      background: "none",
                      color: "#0b5bd3",
                      cursor: "pointer",
                    }}
                    onClick={() => setView("signup")}
                  >
                    sign up
                  </button>
                  .
                </p>
              </div>
            </>
          )}

          {view === "gallery" && (
            <>
              <h1 className="photoload-title">My Images</h1>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: 24,
                  marginBottom: 40,
                }}
              >
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: 4,
                      border: "1px solid #ddd",
                      padding: 8,
                      background: "white",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setSelectedPhoto(photo);
                      setView("viewPhoto");
                    }}
                  >
                    {photoUrls[photo.id] ? (
                      <img
                        src={photoUrls[photo.id]}
                        alt={photo.filename ?? "Photo"}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "#eee" }} />
                    )}
                  </button>
                ))}
              </div>
              <div style={{ textAlign: "center" }}>
                <button
                  className="photoload-primary-button"
                  onClick={() => setView("upload")}
                >
                  Add more Images
                </button>
              </div>
            </>
          )}

          {view === "viewPhoto" && selectedPhoto && (
            <>
              <div className="view-photo-header">
                <button
                  className="photoload-secondary-button"
                  onClick={() => {
                    setSelectedPhoto(null);
                    setView("gallery");
                  }}
                >
                  ← Back
                </button>
                <h1 className="view-photo-title">View Images</h1>
                <div style={{ width: 80 }} className="view-photo-header-spacer" aria-hidden />
              </div>

              <div className="view-photo-layout">
                <div className="view-photo-image-wrap">
                  {photoUrls[selectedPhoto.id] ? (
                    <img
                      src={photoUrls[selectedPhoto.id]}
                      alt={selectedPhoto.filename ?? "Photo"}
                      className="view-photo-image"
                    />
                  ) : (
                    <div className="view-photo-image view-photo-image-placeholder" style={{ background: "#eee" }} />
                  )}
                </div>

                <div className="view-photo-actions">
                  <button
                    className="photoload-primary-button"
                    onClick={() => setView("upload")}
                  >
                    Add more Images
                  </button>

                  <div style={{ marginTop: 8 }}>
                    <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 500, color: "#333" }}>
                      Share with friends
                    </p>
                    <div className="view-photo-share-row">
                      <button
                        type="button"
                        onClick={async () => {
                          const url =
                            typeof window !== "undefined"
                              ? `${window.location.origin}/fit/${selectedPhoto.id}`
                              : "";
                          try {
                            await navigator.clipboard.writeText(url);
                            setCopyLinkFeedback(true);
                            setTimeout(() => setCopyLinkFeedback(false), 2000);
                          } catch {
                            setCopyLinkFeedback(false);
                          }
                        }}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          border: "none",
                          background: "#4a4a4a",
                          color: "white",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                        }}
                        title="Copy link"
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                      </button>
                      <a
                        href={
                          typeof window !== "undefined"
                            ? `https://wa.me/?text=${encodeURIComponent(
                                `Check out this photo on PhotoLoad!\n\n${window.location.origin}/fit/${selectedPhoto.id}`
                              )}`
                            : "#"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          border: "none",
                          background: "#25D366",
                          color: "white",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                          textDecoration: "none",
                        }}
                        title="WhatsApp"
                      >
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                      </a>
                      <button
                        type="button"
                        onClick={async () => {
                          const url =
                            typeof window !== "undefined"
                              ? `${window.location.origin}/fit/${selectedPhoto.id}`
                              : "";
                          const shareData = {
                            title: "Photo on PhotoLoad",
                            text: "Check out this photo on PhotoLoad!",
                            url,
                          };
                          if (typeof navigator !== "undefined" && navigator.share) {
                            try {
                              await navigator.share(shareData);
                            } catch (err) {
                              if ((err as Error).name !== "AbortError") {
                                try {
                                  await navigator.clipboard.writeText(url);
                                  window.open("https://www.instagram.com/", "_blank");
                                } catch {
                                  window.open("https://www.instagram.com/", "_blank");
                                }
                              }
                            }
                          } else {
                            try {
                              await navigator.clipboard.writeText(url);
                              window.open("https://www.instagram.com/", "_blank");
                            } catch {
                              window.open("https://www.instagram.com/", "_blank");
                            }
                          }
                        }}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          border: "none",
                          background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
                          color: "white",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                        }}
                        title="Share to Instagram"
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                        </svg>
                      </button>
                    </div>
                    <div className="view-photo-share-labels">
                      <span>{copyLinkFeedback ? "Copied!" : "Copy link"}</span>
                      <span>WhatsApp</span>
                      <span>Instagram</span>
                    </div>
                  </div>

                  <button
                    className="photoload-secondary-button"
                    onClick={() => deletePhoto(selectedPhoto)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </>
          )}

          {view === "upload" && (
            <>
              <h1 className="photoload-title">Upload Images</h1>
              {uploadError && (
                <p style={{ color: "#c00", marginBottom: 16, textAlign: "center", fontSize: 14 }}>
                  {uploadError}
                </p>
              )}
              <input
                id="photo-upload-input"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />
              <div
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(255,255,255,0.8)",
                  padding: 40,
                  textAlign: "center",
                }}
              >
                {uploadingFiles.length === 0 ? (
                  <>
                    <p style={{ marginBottom: 24 }}>Drop images or upload</p>
                    <p style={{ marginBottom: 16, fontSize: 12, color: "#888" }}>
                      After selecting a file you should see a row here. If nothing appears, open DevTools (F12) → Console and look for &quot;[PhotoLoad] handleFileSelect&quot;.
                    </p>
                    <div
                      style={{
                        width: 96,
                        height: 96,
                        margin: "0 auto 24px",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#f5f5f5",
                        fontSize: 32,
                      }}
                    >
                      ⬆️
                    </div>
                    {!user && (
                      <p style={{ marginBottom: 16, fontSize: 14, color: "#666" }}>
                        Sign in to upload images.
                      </p>
                    )}
                    {user && (
                      <p style={{ marginBottom: 12, fontSize: 12, color: "#666" }}>
                        Signed in as {user.email}
                      </p>
                    )}
                    {user ? (
                      <label
                        htmlFor="photo-upload-input"
                        className="photoload-primary-button"
                        style={{ cursor: "pointer", display: "inline-block", padding: "12px 32px" }}
                      >
                        Select Images
                      </label>
                    ) : (
                      <button className="photoload-primary-button" disabled>
                        Select Images
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {uploadingFiles.map(({ file, progress, error }, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          marginBottom: 16,
                        }}
                      >
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 4,
                            background: "#eee",
                            overflow: "hidden",
                          }}
                        >
                          {file.type.startsWith("image/") && (
                            <img
                              src={URL.createObjectURL(file)}
                              alt=""
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              height: 8,
                              background: "#e0e0e0",
                              borderRadius: 4,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${progress}%`,
                                background: error ? "#c00" : "#22c55e",
                                transition: "width 0.2s",
                              }}
                            />
                          </div>
                          <small style={{ color: "#666" }}>
                            {error ?? (progress >= 100 ? "Done" : "Uploading…")} {file.name}
                          </small>
                        </div>
                      </div>
                    ))}
                    <button
                      className="photoload-primary-button"
                      style={{ marginTop: 16 }}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFiles.some((u) => u.progress < 100 && !u.error)}
                    >
                      Add more Images
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {view === "settings" && (
            <>
              <h1 className="photoload-title">Settings</h1>
              {deleteError && (
                <p style={{ color: "#c00", marginBottom: 16, textAlign: "center", fontSize: 14 }}>
                  {deleteError}
                </p>
              )}
              <div
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(255,255,255,0.8)",
                  padding: 40,
                  textAlign: "center",
                  marginBottom: 32,
                }}
              >
                <p style={{ fontSize: 18, marginBottom: 4 }}>
                  Hi, {user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "there"}
                </p>
                <p style={{ fontSize: 14, color: "#666" }}>
                  {user?.email ?? "handle@email.com"}
                </p>
              </div>
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
                <button
                  className="photoload-secondary-button"
                  onClick={signOut}
                >
                  Sign out
                </button>
                <button
                  className="photoload-primary-button"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete Account
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {showDeleteConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => !deleteAccountLoading && setShowDeleteConfirm(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 24,
              maxWidth: 400,
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ marginBottom: 16, fontSize: 16 }}>
              Are you sure? This will permanently delete your account and all your photos.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                className="photoload-secondary-button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteAccountLoading}
              >
                Cancel
              </button>
              <button
                className="photoload-primary-button"
                style={{ background: "#c00" }}
                onClick={deleteAccount}
                disabled={deleteAccountLoading}
              >
                {deleteAccountLoading ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui",
          }}
        >
          Loading…
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
