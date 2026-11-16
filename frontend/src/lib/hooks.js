import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const useProjects = (category) =>
  useQuery({
    queryKey: ["projects", category || "all"],
    queryFn: async () => (await api.get("/projects", { params: category ? { category } : {} })).data,
  });

export const useUsers = (enabled = true) =>
  useQuery({ queryKey: ["users"], queryFn: async () => (await api.get("/users")).data, enabled });

export const useTempLink = (slug, path, enabled = true) =>
  useQuery({
    queryKey: ["link", slug, path],
    queryFn: async () => (await api.get(`/projects/${slug}/link`, { params: { path } })).data.url,
    enabled: !!(slug && path && enabled),
    staleTime: 30 * 60 * 1000,
  });

const PALETTE = ["#ff4757", "#ffa502", "#2ed573", "#1e90ff", "#ff6b81", "#eccc68", "#7bed9f", "#70a1ff", "#a29bfe"];

export function colorFor(id = "") {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export const initials = (name = "?") => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
