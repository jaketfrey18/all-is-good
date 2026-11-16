import { useNavigate } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCoverflow, Navigation, Pagination, Keyboard } from "swiper/modules";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/pagination";

const arrow = "absolute top-1/2 -translate-y-1/2 z-20 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white text-[#e0141b] grid place-items-center shadow-[0_8px_24px_-6px_rgba(120,20,10,0.45)] border border-[#f1d6cc] hover:bg-[#e0141b] hover:text-white transition-colors duration-200";

export const Coverflow = ({ projects }) => {
  const navigate = useNavigate();
  const start = Math.min(2, Math.max(0, projects.length - 1));
  return (
    <div className="relative w-full" data-testid="project-carousel">
      <button className={`cf-prev ${arrow} left-2 sm:left-10`} aria-label="Previous project" data-testid="carousel-prev-button"><ChevronLeft className="w-8 h-8" strokeWidth={2.6} /></button>
      <button className={`cf-next ${arrow} right-2 sm:right-10`} aria-label="Next project" data-testid="carousel-next-button"><ChevronRight className="w-8 h-8" strokeWidth={2.6} /></button>
      <Swiper
        key={projects.map((p) => p.id).join()}
        className="coverflow !py-8 !overflow-visible"
        modules={[EffectCoverflow, Navigation, Pagination, Keyboard]}
        effect="coverflow"
        centeredSlides
        grabCursor
        keyboard
        slidesPerView="auto"
        initialSlide={start}
        slideToClickedSlide
        coverflowEffect={{ rotate: 28, stretch: -10, depth: 180, modifier: 1, slideShadows: false }}
        navigation={{ prevEl: ".cf-prev", nextEl: ".cf-next" }}
        pagination={{ el: ".cf-dots", clickable: true }}
      >
        {projects.map((p) => (
          <SwiperSlide key={p.id} data-testid={`carousel-slide-${p.slug}`}>
            {({ isActive }) => (
              <button
                onClick={() => isActive && navigate(`/p/${p.slug}`)}
                className="cf-card group relative block w-full h-full rounded-[22px] overflow-hidden bg-[#2d2422]"
                data-testid={`project-card-${p.slug}`}
                aria-label={`Open ${p.title}`}
              >
                <img src={p.cover_url} alt={p.title} className="w-full h-full object-cover" draggable={false} />
                <span className={`absolute inset-x-3 bottom-3 rounded-full bg-[#fff8f0]/90 backdrop-blur-md py-2 text-sm font-bold text-[#2d2422] transition-opacity duration-300 ${isActive ? "opacity-0 group-hover:opacity-100" : "opacity-0"}`}>
                  Enter workspace →
                </span>
              </button>
            )}
          </SwiperSlide>
        ))}
      </Swiper>
      <div className="cf-dots mt-2" data-testid="carousel-pagination" />
    </div>
  );
};
