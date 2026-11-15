import { Mail, MapPin } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { FortuneCookie } from "@/components/FortuneCookie";

export default function ContactPage() {
  return (
    <PageShell eyebrow="Contact" title="Say hello. All is good." testid="contact-page">
      <div className="grid md:grid-cols-[1.2fr_1fr] gap-10 mt-12 items-start">
        <div className="space-y-6">
          <div className="flex items-start gap-4 p-6 rounded-[22px] bg-white/80 border border-[#ecd3c4]" data-testid="contact-email">
            <Mail className="w-6 h-6 text-[#e8262f] mt-1" />
            <div><p className="font-display text-xl font-bold">Email</p><p className="text-[#5b4741]">[your contact email]</p></div>
          </div>
          <div className="flex items-start gap-4 p-6 rounded-[22px] bg-white/80 border border-[#ecd3c4]" data-testid="contact-location">
            <MapPin className="w-6 h-6 text-[#e8262f] mt-1" />
            <div><p className="font-display text-xl font-bold">Studio</p><p className="text-[#5b4741]">[your city / studio address]</p></div>
          </div>
        </div>
        <div className="relative rounded-[28px] bg-[#e8262f] text-[#fff8f0] p-10 overflow-hidden">
          <FortuneCookie className="w-40 absolute -right-4 -top-2 opacity-90 cookie-float" />
          <p className="font-mono text-xs uppercase tracking-[0.3em]">Fortune</p>
          <p className="font-display text-3xl font-extrabold mt-16 leading-tight">Good things are already cooking.</p>
        </div>
      </div>
    </PageShell>
  );
}
