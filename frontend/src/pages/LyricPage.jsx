import { useParams, useNavigate } from "react-router-dom";
import { TopNav } from "@/components/TopNav";
import { LyricEditor } from "@/components/lyrics/LyricEditor";

export default function LyricPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <div className="h-screen flex flex-col bg-[#141011]" data-testid="lyric-page">
      <TopNav dark active="tools" />
      <div className="relative flex-1 mx-3 sm:mx-6 mb-6 rounded-[28px] border border-[#3a2424] bg-[#1a1415] overflow-hidden shadow-[0_0_60px_-20px_rgba(255,71,87,0.35)]">
        <LyricEditor lyricId={id} mode="full" onCollapse={() => navigate(-1)} />
      </div>
    </div>
  );
}
