import { useState } from "react";
import { api } from "../api/client";
import { useAppDispatch, useAppSelector } from "../store/store";
import { setCoins } from "../store/authSlice";
import { IconClose, IconCoin } from "./icons";
import styles from "./BlackjackModal.module.css";

interface Card {
  suit: "♠" | "♥" | "♦" | "♣";
  value: string;
  numValue: number;
}

const PRESET_BETS = [500000, 1000000, 5000000, 10000000, 25000000];

function formatBetLabel(amt: number): string {
  if (amt >= 1000000) return `${amt / 1000000}M`;
  return `${amt / 1000}K`;
}

interface BlackjackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BlackjackModal({ isOpen, onClose }: BlackjackModalProps) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  const [selectedBet, setSelectedBet] = useState<number | "ALL_IN">(1000);
  const [gameState, setGameState] = useState<"IDLE" | "PLAYING" | "BLACKJACK" | "WIN" | "LOSE" | "BUST" | "PUSH">("IDLE");

  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [realDealerHand, setRealDealerHand] = useState<Card[]>([]);

  const [playerVal, setPlayerVal] = useState(0);
  const [dealerVal, setDealerVal] = useState(0);
  const [winnings, setWinnings] = useState(0);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentCoins = Number(user?.coins) || 0;
  const actualBetAmount = selectedBet === "ALL_IN" ? currentCoins : selectedBet;

  async function handleStart() {
    if (loading) return;
    if (currentCoins < actualBetAmount || actualBetAmount <= 0) {
      setErrorMsg("Saldo insuficiente para iniciar la partida.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await api<{
        status: "PLAYING" | "BLACKJACK";
        playerHand: Card[];
        dealerHand: Card[];
        realDealerHand: Card[];
        playerValue: number;
        dealerValue?: number;
        winnings?: number;
        newBalance?: number;
      }>("/blackjack/start", {
        method: "POST",
        body: JSON.stringify({ betAmount: actualBetAmount }),
      });

      setPlayerHand(res.playerHand);
      setDealerHand(res.dealerHand);
      if (res.realDealerHand) setRealDealerHand(res.realDealerHand);
      setPlayerVal(res.playerValue);

      if (res.status === "BLACKJACK") {
        setGameState("BLACKJACK");
        setWinnings(res.winnings || 0);
        setDealerVal(res.dealerValue || 0);
        if (res.newBalance !== undefined) dispatch(setCoins(res.newBalance));
      } else {
        setGameState("PLAYING");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al iniciar la mano de Blackjack.");
    } finally {
      setLoading(false);
    }
  }

  async function handleHit() {
    if (loading || gameState !== "PLAYING") return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await api<{
        status: "PLAYING" | "BUST";
        playerHand: Card[];
        dealerHand: Card[];
        playerValue: number;
        dealerValue?: number;
        newBalance?: number;
      }>("/blackjack/hit", {
        method: "POST",
        body: JSON.stringify({
          betAmount: actualBetAmount,
          playerHand,
          realDealerHand,
        }),
      });

      setPlayerHand(res.playerHand);
      setPlayerVal(res.playerValue);

      if (res.status === "BUST") {
        setGameState("BUST");
        setDealerHand(res.dealerHand);
        setDealerVal(res.dealerValue || 0);
        if (res.newBalance !== undefined) dispatch(setCoins(res.newBalance));
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al pedir carta.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStand() {
    if (loading || gameState !== "PLAYING") return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await api<{
        status: "WIN" | "LOSE" | "PUSH";
        playerHand: Card[];
        dealerHand: Card[];
        playerValue: number;
        dealerValue: number;
        winnings: number;
        newBalance?: number;
      }>("/blackjack/stand", {
        method: "POST",
        body: JSON.stringify({
          betAmount: actualBetAmount,
          playerHand,
          realDealerHand,
        }),
      });

      setDealerHand(res.dealerHand);
      setDealerVal(res.dealerValue);
      setWinnings(res.winnings);
      setGameState(res.status);

      if (res.newBalance !== undefined) {
        dispatch(setCoins(res.newBalance));
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al plantarse.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={() => !loading && gameState !== "PLAYING" && onClose()}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <span style={{ fontSize: "24px" }}>🃏</span>
            <h2>Blackjack 21 Futbolero</h2>
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

          {/* Tapete Verde del Casino */}
          <div className={styles.tableFelt}>
            {/* Mano del Crupier */}
            <div className={styles.handSection}>
              <div className={styles.handHeader}>
                <span>Mano del Crupier</span>
                {gameState !== "IDLE" && gameState !== "PLAYING" && <span>Total: {dealerVal}</span>}
              </div>
              <div className={styles.cardsRow}>
                {dealerHand.map((c, idx) => {
                  const isRed = c.suit === "♥" || c.suit === "♦";
                  return (
                    <div key={idx} className={`${styles.card} ${isRed ? styles.cardRed : ""}`}>
                      <span>{c.value}</span>
                      <span style={{ fontSize: "1.2rem" }}>{c.suit}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mano del Jugador */}
            <div className={styles.handSection}>
              <div className={styles.handHeader}>
                <span>Tu Mano</span>
                {gameState !== "IDLE" && <span>Total: {playerVal}</span>}
              </div>
              <div className={styles.cardsRow}>
                {playerHand.map((c, idx) => {
                  const isRed = c.suit === "♥" || c.suit === "♦";
                  return (
                    <div key={idx} className={`${styles.card} ${isRed ? styles.cardRed : ""}`}>
                      <span>{c.value}</span>
                      <span style={{ fontSize: "1.2rem" }}>{c.suit}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Estado de resultado */}
          {gameState === "BLACKJACK" && (
            <div className={styles.errorBox} style={{ background: "rgba(16, 185, 129, 0.2)", borderColor: "#10b981", color: "#6ee7b7" }}>
              <strong>🎉 ¡BLACKJACK NATURAL (21)!</strong>
              <p style={{ margin: 0, fontSize: "0.85rem" }}>¡Ganaste +${winnings.toLocaleString("es-MX")} Coins! (Pago 3:2)</p>
            </div>
          )}

          {gameState === "WIN" && (
            <div className={styles.errorBox} style={{ background: "rgba(16, 185, 129, 0.2)", borderColor: "#10b981", color: "#6ee7b7" }}>
              <strong>🎉 ¡VICTORIA!</strong>
              <p style={{ margin: 0, fontSize: "0.85rem" }}>Le ganaste al Crupier (+${winnings.toLocaleString("es-MX")} Coins)</p>
            </div>
          )}

          {gameState === "BUST" && (
            <div className={styles.errorBox}>
              <strong>💥 ¡TE PASASTE DE 21!</strong>
              <p style={{ margin: 0, fontSize: "0.85rem" }}>Has perdido la apuesta de {actualBetAmount.toLocaleString("es-MX")} monedas.</p>
            </div>
          )}

          {gameState === "LOSE" && (
            <div className={styles.errorBox}>
              <strong>🔴 EL CRUPIER GANA</strong>
              <p style={{ margin: 0, fontSize: "0.85rem" }}>El crupier obtuvo mayor puntaje sin pasarse.</p>
            </div>
          )}

          {gameState === "PUSH" && (
            <div className={styles.errorBox} style={{ background: "rgba(245, 158, 11, 0.2)", borderColor: "#f59e0b", color: "#fde047" }}>
              <strong>⚖️ ¡EMPATE (PUSH)!</strong>
              <p style={{ margin: 0, fontSize: "0.85rem" }}>Mismo puntaje que el crupier. Apuesta devuelta.</p>
            </div>
          )}

          {errorMsg && <div className={styles.errorBox}>{errorMsg}</div>}

          {/* Botones de Acción (Pedir / Plantarse) */}
          {gameState === "PLAYING" && (
            <div className={styles.actionsRow}>
              <button type="button" className={`${styles.actionBtn} ${styles.hitBtn}`} onClick={handleHit} disabled={loading}>
                ➕ PEDIR CARTA
              </button>
              <button type="button" className={`${styles.actionBtn} ${styles.standBtn}`} onClick={handleStand} disabled={loading}>
                🛑 PLANTARSE
              </button>
            </div>
          )}

          {/* Botón de Iniciar o Re-intentar */}
          {gameState !== "PLAYING" && (
            <>
              <div className={styles.betsSection}>
                <span className={styles.betsLabel}>Selecciona tu apuesta:</span>
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
                className={styles.startBtn}
                onClick={handleStart}
                disabled={loading || currentCoins < actualBetAmount || actualBetAmount <= 0}
              >
                {loading ? "REPARTIENDO CARTAS..." : `REPARTIR CARTAS (${actualBetAmount.toLocaleString("es-MX")} Coins)`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
