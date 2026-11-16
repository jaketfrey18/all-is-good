import { useQuery } from "@tanstack/react-query";
import { api, API, TOKEN_KEY } from "@/lib/api";

const CHUNK = 8 * 1024 * 1024;
export const CATEGORIES = ["Audio", "Video", "Images", "Docs", "Other"];

export const useSessions = (world, enabled = true) => useQuery({
  queryKey: ["sessions", world || "all"], enabled,
  queryFn: async () => (await api.get("/sessions", { params: world ? { world } : {} })).data,
});

export const useSession = (id) => useQuery({
  queryKey: ["session", id], enabled: !!id,
  queryFn: async () => (await api.get(`/sessions/${id}`)).data,
  refetchInterval: (q) => (q.state.data?.files || []).some((f) => f.status === "syncing") ? 2500 : false,
});

export async function uploadChunks(url, file, extra, onProgress) {
  const total = Math.max(1, Math.ceil(file.size / CHUNK));
  const uploadId = crypto.randomUUID();
  let res;
  for (let i = 0; i < total; i += 1) {
    const fd = new FormData();
    Object.entries(extra).forEach(([k, v]) => fd.append(k, v));
    fd.append("upload_id", uploadId);
    fd.append("index", String(i));
    fd.append("total", String(total));
    fd.append("file", new File([file.slice(i * CHUNK, (i + 1) * CHUNK)], file.name || "upload", { type: file.type || "application/octet-stream" }));
    res = await api.post(url, fd, {
      onUploadProgress: (e) => onProgress(Math.min(99, Math.round(((i * CHUNK + (e.loaded || 0)) / Math.max(1, file.size)) * 100))),
    });
  }
  onProgress(100);
  return res.data;
}

export const uploadFile = (sid, file, onProgress) => uploadChunks(`/sessions/${sid}/upload`, file, { name: file.name }, onProgress);

export const downloadUrl = (fid) => `${API}/session-files/${fid}/download?token=${encodeURIComponent(localStorage.getItem(TOKEN_KEY) || "")}`;
