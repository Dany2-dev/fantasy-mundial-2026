import { useState } from "react";
import { api } from "../api/client";
import { useAppDispatch, useAppSelector } from "../store/store";
import { setCoins } from "../store/authSlice";
import { IconClose, IconCoin } from "./icons";
import styles from "./PenaltyModal.module.css";

export interface PenaltyLevel {
  level: number;
  multiplier: number;
  goalChance: number;
}

// Generador de 100 Niveles idéntico al backend
export const PENALTY_LEVELS: PenaltyLevel[] = Array.from({ length: 100 }, (_, i) => {
  const level = i + 1;

  let multiplier: number;
  if (level === 1) multiplier = 1.25;
  else if (level <= 5) multiplier = Number((1.25 + (level - 1) * 0.45).toFixed(2));
  else if (level <= 10) multiplier = Number((3.1 + (level - 5) * 1.1).toFixed(2));
  else if (level <= 25) multiplier = Number((8.5 + (level - 10) * 4.4).toFixed(1));
  else if (level <= 50) multiplier = Math.round(75 + Math.pow(level - 25, 2.4) * 0.9);
  else if (level <= 75) multiplier = Math.round(2500 + Math.pow(level - 50, 2.8) * 4.2);
  else multiplier = Math.round(50000 + Math.pow(level - 75, 3.15) * 60);

  if (level === 100) multiplier = 1000000;

  let goalChance: number;
  if (level <= 5) goalChance = 90 - (level - 1) * 2.5;
  else if (level <= 15) goalChance = 80 - (level - 5) * 1.5;
  else if (level <= 30) goalChance = 65 - (level - 15) * 1.0;
  else if (level <= 50) goalChance = 50 - (level - 30) * 0.85;
  else if (level <= 75) goalChance = 33 - (level - 50) * 0.6;
  else goalChance = Math.max(5, Math.round(18 - (level - 75) * 0.52));

  return { level, multiplier, goalChance: Math.round(goalChance) };
});

const PRESET_BETS = [500000, 1000000, 5000000, 10000000, 25000000];

function formatBetLabel(amt: number): string {
  if (amt >= 1000000) return `${amt / 1000000}M`;
  return `${amt / 1000}K`;
}

function formatMultiplierLabel(m: number): string {
  if (m >= 1000000) return "1M x 🏆";
  if (m >= 1000) return `${Math.round(m / 1000)}Kx`;
  return `${m}x`;
}

interface PenaltyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PenaltyModal({ isOpen, onClose }: PenaltyModalProps) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  const [selectedBet, setSelectedBet] = useState<number | "ALL_IN">(1000000);
  const [isShootoutActive, setIsShootoutActive] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [gameState, setGameState] = useState<"idle" | "animating" | "goal" | "saved">("idle");
  const [currentWinnings, setCurrentWinnings] = useState(0);

  const [shotDirection, setShotDirection] = useState<"left" | "center" | "right" | null>(null);
  const [keeperDived, setKeeperDived] = useState<"left" | "center" | "right" | null>(null);

  const [showCoinsBurst, setShowCoinsBurst] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentCoins = Number(user?.coins) || 0;
  const actualBetAmount = selectedBet === "ALL_IN" ? currentCoins : selectedBet;

  function resetGame() {
    setIsShootoutActive(false);
    setGameState("idle");
    setCurrentRound(1);
    setCurrentWinnings(0);
    setShotDirection(null);
    setKeeperDived(null);
    setShowCoinsBurst(false);
    setErrorMsg(null);
  }

  function handleStartShootout() {
    if (actualBetAmount <= 0) {
      setErrorMsg("No tienes suficiente saldo para apostar.");
      return;
    }
    if (currentCoins < actualBetAmount) {
      setErrorMsg(`Saldo insuficiente. Tienes ${currentCoins.toLocaleString("es-MX")} monedas.`);
      return;
    }
    setErrorMsg(null);
    setIsShootoutActive(true);
  }

  async function handleShoot(dir: "left" | "center" | "right") {
    if (!isShootoutActive || loading || gameState === "animating") return;

    setLoading(true);
    setErrorMsg(null);
    setShowCoinsBurst(false);

    setShotDirection(null);
    setKeeperDived(null);
    setGameState("animating");

    setTimeout(async () => {
      setShotDirection(dir);
      try {
        const res = await api<{
          isGoal: boolean;
          keeperDived: "left" | "center" | "right";
          currentRound: number;
          nextRound: number;
          multiplier: number;
          currentWinnings: number;
          newBalance?: number;
        }>("/penalties/shoot", {
          method: "POST",
          body: JSON.stringify({
            betAmount: actualBetAmount,
            direction: dir,
            currentRound,
          }),
        });

        setKeeperDived(res.keeperDived);

        setTimeout(() => {
          setLoading(false);
          if (res.isGoal) {
            setGameState("goal");
            setCurrentWinnings(res.currentWinnings);
            setCurrentRound(res.nextRound);
            setShowCoinsBurst(true);

            setTimeout(() => {
              setShotDirection(null);
              setKeeperDived(null);
            }, 1500);
          } else {
            setGameState("saved");
            if (res.newBalance !== undefined) {
              dispatch(setCoins(res.newBalance));
            }
          }
        }, 700);
      } catch (err: any) {
        setLoading(false);
        setGameState("idle");
        setShotDirection(null);
        setKeeperDived(null);
        setErrorMsg(err.message || "Error al realizar el tiro de penal.");
      }
    }, 50);
  }

  async function handleCashOut() {
    if (loading || currentWinnings <= actualBetAmount) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await api<{
        success: boolean;
        winnings: number;
        newBalance: number;
      }>("/penalties/cashout", {
        method: "POST",
        body: JSON.stringify({
          betAmount: actualBetAmount,
          winnings: currentWinnings,
          roundCompleted: currentRound - 1,
        }),
      });

      if (res.success) {
        dispatch(setCoins(res.newBalance));
        resetGame();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al retirar las ganancias.");
    } finally {
      setLoading(false);
    }
  }

  // Visor deslizante de 7 niveles centrados en el nivel actual
  const startLevelWindow = Math.max(1, Math.min(currentRound - 2, 94));
  const visibleLevels = PENALTY_LEVELS.slice(startLevelWindow - 1, startLevelWindow + 6);

  return (
    <div className={styles.overlay} onClick={() => !loading && !isShootoutActive && onClose()}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <span style={{ fontSize: "24px" }}>⚽</span>
            <h2>Tanda de Penaltis (100 Niveles 🏆)</h2>
          </div>
          <button className={styles.closeBtn} onClick={() => !loading && onClose()} disabled={loading}>
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

          {/* Indicador Hito de 100 Niveles */}
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: "0.8rem", color: "#94a3b8", fontWeight: 700 }}>
            <span>Nivel {currentRound} / 100</span>
            <span>Hito Final: 1,000,000x 🏆</span>
          </div>

          {/* Escala deslizante inteligente de Niveles */}
          <div className={styles.multiplierLadder}>
            {visibleLevels.map((lvl) => {
              const isActive = lvl.level === currentRound;
              const isPast = lvl.level < currentRound;
              return (
                <div
                  key={lvl.level}
                  className={`${styles.stepBadge} ${isActive ? styles.stepActive : ""}`}
                  style={{ opacity: isPast ? 0.4 : 1 }}
                >
                  <span>N{lvl.level}</span>
                  <strong>{formatMultiplierLabel(lvl.multiplier)}</strong>
                </div>
              );
            })}
          </div>

          {/* Estadio 3D y Portería */}
          <div className={styles.stadiumPitch}>
            <div className={styles.floodlightLeft} />
            <div className={styles.floodlightRight} />

            {/* Marco de Portería 3D con Dianas Centradas */}
            <div className={styles.goalFrame3D}>
              <button
                type="button"
                className={`${styles.targetBtn} ${!isShootoutActive ? styles.lockedTarget : ""}`}
                onClick={() => handleShoot("left")}
                disabled={!isShootoutActive || loading || gameState === "animating"}
              >
                {isShootoutActive ? "🎯 Izquierda" : "🔒 Bloqueado"}
              </button>
              <button
                type="button"
                className={`${styles.targetBtn} ${!isShootoutActive ? styles.lockedTarget : ""}`}
                onClick={() => handleShoot("center")}
                disabled={!isShootoutActive || loading || gameState === "animating"}
              >
                {isShootoutActive ? "🎯 Centro" : "🔒 Bloqueado"}
              </button>
              <button
                type="button"
                className={`${styles.targetBtn} ${!isShootoutActive ? styles.lockedTarget : ""}`}
                onClick={() => handleShoot("right")}
                disabled={!isShootoutActive || loading || gameState === "animating"}
              >
                {isShootoutActive ? "🎯 Derecha" : "🔒 Bloqueado"}
              </button>
            </div>

            {/* Guante de Portero Gigante 🧤 Centrado */}
            <div
              className={`${styles.giantGlove} ${
                keeperDived === "left"
                  ? styles.gloveDiveLeft
                  : keeperDived === "right"
                  ? styles.gloveDiveRight
                  : keeperDived === "center"
                  ? styles.gloveJumpCenter
                  : ""
              }`}
            >
              🧤
            </div>

            {/* Punto y Balón 3D en Vuelo */}
            <div className={styles.penaltySpot} />
            <div
              className={`${styles.ball3D} ${
                shotDirection === "left"
                  ? styles.ballFlyLeft
                  : shotDirection === "right"
                  ? styles.ballFlyRight
                  : shotDirection === "center"
                  ? styles.ballFlyCenter
                  : ""
              }`}
            >
              ⚽
            </div>

            {/* Ráfaga de Monedas de Oro 🪙 al celebrar Gol */}
            {showCoinsBurst && (
              <div className={styles.goldCoinBurst}>
                <span className={styles.coinParticle}>🪙</span>
                <span className={styles.coinParticle} style={{ animationDelay: "0.1s" }}>🪙</span>
                <span className={styles.coinParticle} style={{ animationDelay: "0.2s" }}>🪙</span>
                <span className={styles.coinParticle} style={{ animationDelay: "0.3s" }}>🪙</span>
              </div>
            )}
          </div>

          {/* Celebración de Gol & Botón Cash Out */}
          {gameState === "goal" && (
            <div className={styles.celebrationBanner}>
              <div>
                <span style={{ fontSize: "0.85rem", color: "#6ee7b7", fontWeight: 800 }}>
                  ⚽💥 ¡GOLAZO! (Nivel {currentRound - 1} superado)
                </span>
                <div className={styles.cashOutAmount}>+${currentWinnings.toLocaleString("es-MX")} Coins</div>
              </div>
              <button
                type="button"
                className={styles.cashOutBtn}
                onClick={handleCashOut}
                disabled={loading}
              >
                💰 RETIRAR GANANCIAS
              </button>
            </div>
          )}

          {gameState === "saved" && (
            <div className={styles.errorBox}>
              <strong>🧤 ¡ATAJADO EN EL NIVEL {currentRound}!</strong>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem" }}>
                Has perdido la racha y la apuesta de {actualBetAmount.toLocaleString("es-MX")} monedas.
              </p>
              <button
                type="button"
                className={styles.cashOutBtn}
                style={{ marginTop: "10px", background: "#334155" }}
                onClick={resetGame}
              >
                🔄 INTENTAR NUEVA TANDA
              </button>
            </div>
          )}

          {errorMsg && <div className={styles.errorBox}>{errorMsg}</div>}

          {/* Selector de Apuestas e Iniciar Tanda */}
          {!isShootoutActive && (
            <>
              <div className={styles.betsSection}>
                <span className={styles.betsLabel}>1. Selecciona el monto a apostar:</span>
                <div className={styles.betsGrid}>
                  {PRESET_BETS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      className={`${styles.betBtn} ${selectedBet === amt ? styles.betBtnActive : ""}`}
                      onClick={() => setSelectedBet(amt)}
                      disabled={loading}
                    >
                      {formatBetLabel(amt)} <IconCoin size={12} />
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`${styles.betBtn} ${styles.allInBtn} ${selectedBet === "ALL_IN" ? styles.betBtnActive : ""}`}
                    onClick={() => setSelectedBet("ALL_IN")}
                    disabled={loading}
                  >
                    🔥 ALL-IN ({currentCoins.toLocaleString("es-MX")} Coins)
                  </button>
                </div>
              </div>

              <button
                type="button"
                className={styles.startBetBtn}
                onClick={handleStartShootout}
                disabled={loading || currentCoins < actualBetAmount || actualBetAmount <= 0}
              >
                APOSTAR E INICIAR TANDA (100 NIVEL {actualBetAmount.toLocaleString("es-MX")} Coins)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
