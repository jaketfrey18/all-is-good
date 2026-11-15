import { Folder, FileImage, FileVideo, FileAudio, FileText, Presentation, File } from "lucide-react";
import { fileKind } from "@/lib/api";

const MAP = { image: FileImage, video: FileVideo, audio: FileAudio, pdf: FileText, deck: Presentation, doc: FileText, other: File };

export const FileIcon = ({ item, className = "w-8 h-8" }) => {
  if (item.type === "folder") return <Folder className={`${className} text-[#e8a23b]`} fill="#f7c873" />;
  const Icon = MAP[fileKind(item.ext)];
  return <Icon className={`${className} text-[#e8262f]`} strokeWidth={1.5} />;
};
