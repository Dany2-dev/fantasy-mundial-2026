import { Img, interpolate, useCurrentFrame } from "remotion";

interface SealedPackProps {
  src: string;
  shakeProgress?: number; // 0-1, tiembla más fuerte a medida que sube
}

// El sobre cerrado: leve balanceo continuo + brillo diagonal recorriendo el
// foil, y tiembla con más fuerza a medida que shakeProgress avanza.
export default function SealedPack({ src, shakeProgress = 0 }: SealedPackProps) {
  const frame = useCurrentFrame();
  const wobble = Math.sin(frame / 20) * 4;
  const shake = shakeProgress > 0 ? Math.sin(frame * 2.4) * shakeProgress * 6 : 0;
  const shineX = interpolate(frame % 70, [0, 70], [-260, 260]);

  return (
    <div
      style={{
        position: "relative",
        width: 220,
        height: 220,
        transform: `rotate(${wobble + shake}deg)`,
      }}
    >
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          filter: "drop-shadow(0 20px 40px rgba(240,194,75,0.45))",
        }}
      />
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 18, pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: shineX,
            width: 60,
            height: "100%",
            background: "linear-gradient(100deg, transparent, rgba(255,255,255,0.55), transparent)",
            transform: "skewX(-18deg)",
          }}
        />
      </div>
    </div>
  );
}
