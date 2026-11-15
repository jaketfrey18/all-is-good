import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const TOKEN_KEY = "aig_admin_token";

export const api = axios.create({ baseURL: API, withCredentials: true });

api.interceptors.request.use((config) => {
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export function errText(e) {
  const d = e?.response?.data?.detail;
  if (!d) return e?.message || "Something went wrong.";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  return d.msg || String(d);
}

export const CATEGORIES = ["projects", "worlds", "media", "presentations"];

const KINDS = {
  image: ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic", "tif", "tiff"],
  video: ["mp4", "mov", "webm", "m4v", "avi", "mkv"],
  audio: ["mp3", "wav", "m4a", "aac", "ogg", "flac"],
  pdf: ["pdf"],
  deck: ["ppt", "pptx", "key"],
  doc: ["doc", "docx", "txt", "md", "pages", "rtf"],
};

export function fileKind(ext = "") {
  const e = ext.toLowerCase();
  return Object.keys(KINDS).find((k) => KINDS[k].includes(e)) || "other";
}

export function fmtSize(b) {
  if (b == null) return "";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i += 1; }
  return `${b.toFixed(i ? 1 : 0)} ${u[i]}`;
}

export const thumbUrl = (slug, path) => `${API}/projects/${slug}/thumb?path=${encodeURIComponent(path)}`;
