import { useQuery } from "@tanstack/react-query";
import { api, API, TOKEN_KEY, fileKind } from "@/lib/api";

export const useMyWorlds = (enabled = true) => useQuery({ queryKey: ["my-worlds"], enabled, queryFn: async () => (await api.get("/worlds/mine")).data });

export const useWorldAssets = (world) => useQuery({ queryKey: ["assets", world], enabled: !!world, queryFn: async () => (await api.get("/assets", { params: { world } })).data });

export const mediaUrl = (aid, opts = "") => `${API}/assets/${aid}/media?token=${encodeURIComponent(localStorage.getItem(TOKEN_KEY) || "")}${opts}`;

export const kindOf = (f) => f.media_type || f.type_hint || fileKind(f.ext);

export const useAssetLink = (aid, enabled = true) => useQuery({
  queryKey: ["asset-link", aid], enabled: !!aid && enabled, retry: false, staleTime: 20 * 60 * 1000,
  queryFn: async () => { const u = (await api.get(`/assets/${aid}/link`)).data.url; return u.startsWith("/") ? `${process.env.REACT_APP_BACKEND_URL}${u}` : u; },
});
