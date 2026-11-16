import { useEffect, useMemo } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Sun, Clouds, Skyline, Mesh, Floor, Flowers } from "@/components/hero/SceneLayers";

const Layer = ({ mx, my, depth, children }) => {
  const x = useTransform(mx, (v) => v * depth);
  const y = useTransform(my, (v) => v * depth * 0.6);
  return (
    <motion.svg style={{ x, y }} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className="absolute -inset-10 w-[calc(100%+80px)] h-[calc(100%+80px)]">
      {children}
    </motion.svg>
  );
};

export const HeroScene = () => {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const mx = useSpring(rx, { stiffness: 35, damping: 18 });
  const my = useSpring(ry, { stiffness: 35, damping: 18 });

  useEffect(() => {
    const onMove = (e) => {
      rx.set((e.clientX / window.innerWidth - 0.5) * -2);
      ry.set((e.clientY / window.innerHeight - 0.5) * -2);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [rx, ry]);

  const layers = useMemo(() => [
    [4, <Sun key="s" />], [12, <Skyline key="k" />], [8, <Clouds key="c" />],
    [16, <Mesh key="m" />], [6, <Floor key="f" />], [26, <Flowers key="fl" />],
  ], []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[#fff8f5] via-[#fff1ec] to-[#fbe1da] grain" aria-hidden="true" data-testid="hero-scene">
      {layers.map(([d, el], i) => <Layer key={i} mx={mx} my={my} depth={d}>{el}</Layer>)}
    </div>
  );
};
