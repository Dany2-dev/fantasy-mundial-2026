import { useState } from "react";
import {
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { initials } from "../../components/PlayerCard";
import { RARITY_COLOR } from "../../lib/rarityColors";
import { Player, rarityOf } from "../../types";
import AnimatedCounter from "./AnimatedCounter";

interface HighlightPlayerCardProps {
  player: Player;
  isCaptain?: boolean;
}

export default function HighlightPlayerCard({
  player,
  isCaptain = false,
}: HighlightPlayerCardProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const [photoFailed, setPhotoFailed] = useState(false);

  const glow = RARITY_COLOR[rarityOf(player.rating)];

  const enter = spring({
    frame,
    fps,
    delay: 8,
    config: {
      damping: 18,
      stiffness: 55,
      mass: 1.6,
    },
  });

  const scale = interpolate(enter, [0, 1], [0.45, 1]);

  const rotate = interpolate(
    enter,
    [0, 1],
    [-12, 0]
  );

  const opacity = interpolate(
    frame,
    [0, 6, durationInFrames - 6, durationInFrames],
    [0, 1, 1, 0]
  );

  const blur = interpolate(
    frame,
    [0, 8],
    [10, 0],
    {
      extrapolateRight: "clamp",
    }
  );

  const float = Math.sin(frame / 18) * 7;

  const shine = interpolate(
    frame,
    [0, durationInFrames],
    [-250, 700]
  );

  const showPhoto = Boolean(player.photoUrl && !photoFailed);

  return (
    <div
      style={{
        position: "relative",

        width: 520,

        transform: `
          translateY(${float}px)
          scale(${scale})
          rotate(${rotate}deg)
        `,

        opacity,

        filter: `blur(${blur}px)`,

        borderRadius: 42,

        padding: 4,

        overflow: "hidden",

        background: `
          linear-gradient(
            145deg,
            ${glow},
            rgba(255,255,255,.15),
            rgba(255,255,255,.02),
            ${glow}
          )
        `,

        boxShadow: `
          0 0 35px ${glow},
          0 0 120px ${glow},
          0 40px 90px rgba(0,0,0,.55)
        `,
      }}
    >
      <div
        style={{
          position: "relative",

          overflow: "hidden",

          borderRadius: 38,

          padding: "40px 34px",

          display: "flex",

          flexDirection: "column",

          alignItems: "center",

          gap: 18,

          background: `
            linear-gradient(
              180deg,
              rgba(25,33,53,.95),
              rgba(12,17,27,.94)
            )
          `,

          backdropFilter: "blur(20px)",
        }}
      >
        {/* Fondo radial */}

        <div
          style={{
            position: "absolute",

            inset: 0,

            background: `
              radial-gradient(
                circle at top,
                ${glow}35 0%,
                transparent 65%
              )
            `,
          }}
        />

        {/* Glow inferior */}

        <div
          style={{
            position: "absolute",

            bottom: -180,

            width: 500,

            height: 500,

            borderRadius: "50%",

            background: glow,

            filter: "blur(140px)",

            opacity: .25,
          }}
        />

        {/* Shine */}

        <div
          style={{
            position: "absolute",

            top: -60,

            left: shine,

            width: 120,

            height: 900,

            transform: "rotate(25deg)",

            background: `
              linear-gradient(
                90deg,
                transparent,
                rgba(255,255,255,.40),
                transparent
              )
            `,
          }}
        />

        {/* FOTO */}

        <div
          style={{
            position: "relative",

            width: 230,

            height: 220,

            borderRadius: "50%",

            overflow: "hidden",

            border: `6px solid ${glow}`,

            background: "#2a3650",

            boxShadow: `
              0 0 25px ${glow},
              inset 0 0 25px rgba(255,255,255,.15)
            `,
          }}
        >
          {showPhoto ? (
            <Img
              src={player.photoUrl as string}
              onError={() => setPhotoFailed(true)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",

                display: "flex",

                alignItems: "center",

                justifyContent: "center",

                color: "white",

                fontSize: 82,

                fontWeight: 900,
              }}
            >
              {initials(player.name)}
            </div>
          )}
          {isCaptain && (
            <div
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                width: 48,
                height: 48,
                borderRadius: "50%",
                background:
                  "linear-gradient(180deg,#FFD86B,#E8A700)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#111",
                fontWeight: 900,
                fontSize: 22,
                boxShadow:
                  "0 0 20px rgba(255,216,107,.8)",
              }}
            >
              C
            </div>
          )}
        </div>

        {/* Rating */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 8,
          }}
        >
          <div
            style={{
              fontSize: 90,
              fontWeight: 900,
              lineHeight: 1,
              color: "#ffffff",
              textShadow: `
                0 0 15px ${glow},
                0 0 35px ${glow}
              `,
            }}
          >
            <AnimatedCounter
              value={player.rating}
              startFrame={4}
              durationInFrames={20}
            />
          </div>
        </div>

        {/* Nombre */}

        <div
          style={{
            textAlign: "center",
            color: "#fff",
            fontSize: 38,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: 1,
            textTransform: "uppercase",
            textShadow:
              "0 4px 12px rgba(0,0,0,.5)",
            maxWidth: "90%",
          }}
        >
          {player.name}
        </div>

        {/* Posición */}

        <div
          style={{
            padding: "10px 28px",
            borderRadius: 999,
            background: `${glow}25`,
            border: `2px solid ${glow}`,
            color: "#fff",
            fontWeight: 800,
            fontSize: 22,
            letterSpacing: 2,
            textTransform: "uppercase",
            boxShadow: `0 0 20px ${glow}55`,
          }}
        >
          {player.position}
        </div>

        {/* Equipo */}

        <div
          style={{
            color: "#BFC8D8",
            fontSize: 22,
            fontWeight: 600,
            textAlign: "center",
            maxWidth: "90%",
          }}
        >
          {player.team?.name ?? ""}
        </div>

        {/* Línea decorativa */}

        <div
          style={{
            width: "75%",
            height: 3,
            borderRadius: 999,
            background: `linear-gradient(
              90deg,
              transparent,
              ${glow},
              transparent
            )`,
            marginTop: 8,
          }}
        />

        {/* Glow inferior */}

        <div
          style={{
            position: "absolute",
            bottom: -100,
            width: 340,
            height: 340,
            borderRadius: "50%",
            background: glow,
            filter: "blur(120px)",
            opacity: 0.18,
          }}
        />
      </div>
    </div>
  );
}