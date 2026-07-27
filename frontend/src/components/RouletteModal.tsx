import { useState } from "react";
import { api } from "../api/client";
import { useAppDispatch, useAppSelector } from "../store/store";
import { setCoins } from "../store/authSlice";
import { IconClose, IconCoin } from "./icons";
import styles from "./RouletteModal.module.css";

interface Slice {
  index: number;
  label: string;
  multiplier: number;
  color: string;
  text: string;
}

const SLICES: Slice[] = [
  { index: 0, label: "0x", multiplier: 0, color: "#ef4444", text: "Pierdes Todo" },
  { index: 1, label: "0.2x", multiplier: 0.2, color: "#f97316", text: "Retorna 20%" },
  { index: 2, label: "0.5x", multiplier: 0.5, color: "#f59e0b", text: "Retorna Mitad" },
  { index: 3, label: "1.0x", multiplier: 1.0, color: "#eab308", text: "Empate" },
  { index: 4, label: "1.5x", multiplier: 1.5, color: "#10b981", text: "+50% Bonus" },
  { index: 5, label: "2x", multiplier: 2.0, color: "#06b6d4", text: "¡Doble!" },
  { index: 6, label: "3x", multiplier: 3.0, color: "#3b82f6", text: "¡Triple!" },
  { index: 7, label: "5x", multiplier: 5.0, color: "#8b5cf6", text: "¡Gran Premio!" },
  { index: 8, label: "15x", multiplier: 15.0, color: "#d946ef", text: "¡MEGA PREMIO!" },
  { index: 9, label: "50x", multiplier: 50.0, color: "#ec4899", text: "¡SUPER JACKPOT!" },
];

const PRESET_BETS = [500000, 1000000, 5000000, 10000000, 25000000];

function formatBetLabel(amt: number): string {
  if (amt >= 1000000) return `${amt / 1000000}M`;
  return `${amt / 1000}K`;
}

interface RouletteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RouletteModal({ isOpen, onClose }: RouletteModalProps) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  const [selectedBet, setSelectedBet] = useState<number | "ALL_IN">(1000);
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [spinResult, setSpinResult] = useState<{
    slice: Slice;
    payoutCoins: number;
    netChange: number;
  } | null>(null);

  if (!isOpen) return null;

  const currentCoins = Number(user?.coins) || 0;
  const actualBetAmount = selectedBet === "ALL_IN" ? currentCoins : selectedBet;

  async function handleSpin() {
    if (isSpinning) return;
    if (actualBetAmount <= 0) {
      setErrorMsg("No tienes suficiente saldo para apostar.");
      return;
    }
    if (currentCoins < actualBetAmount) {
      setErrorMsg(`Saldo insuficiente. Tienes ${currentCoins.toLocaleString("es-MX")} monedas.`);
      return;
    }

    setIsSpinning(true);
    setErrorMsg(null);
    setSpinResult(null);

    try {
      const res = await api<{
        success: boolean;
        sliceIndex: number;
        payoutCoins: number;
        netChange: number;
        newBalance: number;
      }>("/roulette/spin", {
        method: "POST",
        body: JSON.stringify({ betAmount: actualBetAmount }),
      });

      const winIndex = res.sliceIndex;
      // 10 segmentos = 36 deg cada uno
      const sliceCenter = (winIndex + 0.5) * 36;
      const desiredAngle = (360 - (sliceCenter % 360)) % 360;

      const currentMod = rotation % 360;
      let delta = (desiredAngle - currentMod) % 360;
      if (delta <= 0) delta += 360;

      // 12 giros completos (4320 deg) para animación dramática de 6.5s
      const nextRotation = rotation + (12 * 360) + delta;
      setRotation(nextRotation);

      setTimeout(() => {
        setIsSpinning(false);
        const winningSlice = SLICES.find((s) => s.index === winIndex) || SLICES[0];
        setSpinResult({
          slice: winningSlice,
          payoutCoins: res.payoutCoins,
          netChange: res.netChange,
        });

        // Actualizar saldo global en Redux
        dispatch(setCoins(res.newBalance));
      }, 6500);
    } catch (err: any) {
      setIsSpinning(false);
      setErrorMsg(err.message || "Error al realizar el giro.");
    }
  }

  const radius = 100;
  const center = 100;

  return (
    <div className={styles.overlay} onClick={() => !isSpinning && onClose()}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <span style={{ fontSize: "24px" }}>🎰</span>
            <h2>Ruleta de la Suerte (10x / 50x)</h2>
          </div>
          <button className={styles.closeBtn} onClick={() => !isSpinning && onClose()} disabled={isSpinning}>
            <IconClose size={20} />
          </button>
        </header>

        <div className={styles.body}>
          {/* Saldo actual */}
          <div className={styles.balanceRow}>
            <span>Tu Saldo Disponible:</span>
            <span className={styles.balanceValue}>
              {currentCoins.toLocaleString("es-MX")} <IconCoin size={18} />
            </span>
          </div>

          {/* Anillo exterior Neón + Ruleta giratoria */}
          <div className={styles.wheelOuterRing}>
            <div className={styles.pointer} />
            <svg
              className={styles.wheelSvg}
              viewBox="0 0 200 200"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              {SLICES.map((s) => {
                const anglePerSlice = 36;
                const startAngle = (s.index * anglePerSlice - 90) * (Math.PI / 180);
                const endAngle = ((s.index + 1) * anglePerSlice - 90) * (Math.PI / 180);

                const x1 = center + radius * Math.cos(startAngle);
                const y1 = center + radius * Math.sin(startAngle);
                const x2 = center + radius * Math.cos(endAngle);
                const y2 = center + radius * Math.sin(endAngle);

                const midAngle = ((s.index + 0.5) * anglePerSlice - 90) * (Math.PI / 180);
                const textRadius = 66;
                const textX = center + textRadius * Math.cos(midAngle);
                const textY = center + textRadius * Math.sin(midAngle);
                const textRotation = (s.index + 0.5) * anglePerSlice;

                const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`;

                return (
                  <g key={s.index}>
                    <path d={pathData} fill={s.color} stroke="#0f172a" strokeWidth="1.5" />
                    <text
                      x={textX}
                      y={textY}
                      fill="#ffffff"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="central"
                      transform={`rotate(${textRotation + 90}, ${textX}, ${textY})`}
                    >
                      {s.label}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className={styles.centerCap}>⚽</div>
          </div>

          {/* Resultado del giro */}
          {spinResult && (
            <div
              className={`${styles.resultCard} ${
                spinResult.payoutCoins > actualBetAmount
                  ? styles.winResult
                  : spinResult.payoutCoins === actualBetAmount
                  ? styles.evenResult
                  : styles.lossResult
              }`}
            >
              <span className={styles.resultTitle}>
                {spinResult.payoutCoins > actualBetAmount
                  ? `🎉 ¡Ganaste +${spinResult.payoutCoins.toLocaleString("es-MX")} Monedas!`
                  : spinResult.payoutCoins === actualBetAmount
                  ? "⚖️ ¡Recuperaste tu apuesta!"
                  : `Obtuviste ${spinResult.payoutCoins.toLocaleString("es-MX")} Monedas`}
              </span>
              <span className={styles.resultSubtitle}>
                Multiplicador obtenido: {spinResult.slice.label} ({spinResult.slice.text})
              </span>
            </div>
          )}

          {errorMsg && <div className={styles.errorBox}>{errorMsg}</div>}

          {/* Selector de apuestas */}
          <div className={styles.betsSection}>
            <span className={styles.betsLabel}>Selecciona el monto a apostar:</span>
            <div className={styles.betsGrid}>
              {PRESET_BETS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className={`${styles.betBtn} ${selectedBet === amt ? styles.betBtnActive : ""}`}
                  onClick={() => setSelectedBet(amt)}
                  disabled={isSpinning}
                >
                  {formatBetLabel(amt)} <IconCoin size={12} />
                </button>
              ))}
              <button
                type="button"
                className={`${styles.betBtn} ${styles.allInBtn} ${selectedBet === "ALL_IN" ? styles.betBtnActive : ""}`}
                onClick={() => setSelectedBet("ALL_IN")}
                disabled={isSpinning}
              >
                🔥 ALL-IN ({currentCoins.toLocaleString("es-MX")} Coins)
              </button>
            </div>
          </div>

          {/* Botón de Giro */}
          <button
            type="button"
            className={styles.spinBtn}
            onClick={handleSpin}
            disabled={isSpinning || currentCoins < actualBetAmount || actualBetAmount <= 0}
          >
            {isSpinning
              ? "GIRANDO RULETA (6.5s)..."
              : `GIRAR RULETA (${actualBetAmount.toLocaleString("es-MX")} Coins)`}
          </button>
        </div>
      </div>
    </div>
  );
}
