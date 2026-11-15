import { useState } from "react";
import { FileIcon } from "@/components/workspace/FileIcon";
import { fmtSize, thumbUrl } from "@/lib/api";

const Thumb = ({ slug, item }) => {
  const [failed, setFailed] = useState(false);
  if (item.type === "file" && item.thumb && !failed) {
    return <img src={thumbUrl(slug, item.path)} alt="" loading="lazy" onError={() => setFailed(true)} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />;
  }
  return <div className="w-full h-full grid place-items-center bg-[#fbeee4]"><FileIcon item={item} className="w-12 h-12" /></div>;
};

export const FileGrid = ({ slug, items, onOpen }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="file-grid">
    {items.map((it) => (
      <button key={it.path} onClick={() => onOpen(it)} className="group text-left rounded-2xl overflow-hidden bg-white border border-[#ecd3c4] hover:border-[#e8262f] hover:-translate-y-0.5 transition-[transform,border-color] duration-200" data-testid={`file-item-${it.name}`}>
        <div className="aspect-[4/3] overflow-hidden"><Thumb slug={slug} item={it} /></div>
        <div className="p-3">
          <p className="font-semibold text-sm truncate">{it.name}</p>
          <p className="font-mono text-[11px] text-[#7a5f56]">{it.type === "folder" ? "folder" : `${it.ext || "file"} · ${fmtSize(it.size)}`}</p>
        </div>
      </button>
    ))}
  </div>
);
