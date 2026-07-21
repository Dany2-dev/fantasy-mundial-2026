import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAppDispatch, useAppSelector } from "../store/store";
import { fetchMe, setCoins } from "../store/authSlice";
import { IconCoin, IconCheck } from "../components/icons";
import styles from "./Shop.module.css";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  referenceId: string | null;
  description: string | null;
  createdAt: string;
}

const PACKS = [
  {
    id: "coins-pack-small",
    name: "Bolsa de Monedas",
    coins: 5000,
    price: "$4.99 USD",
    badge: null,
    desc: "Perfecta para comprar tus primeros sobres de bronce y plata.",
    styleClass: "bronzePack",
  },
  {
    id: "coins-pack-medium",
    name: "Cofre de Monedas",
    coins: 11000,
    price: "$9.99 USD",
    badge: "10% BONUS INCLUIDO",
    desc: "Excelente valor para expandir tu plantilla y asegurar jugadores oro.",
    styleClass: "goldPack",
  },
  {
    id: "coins-pack-large",
    name: "Caja Fuerte de Monedas",
    coins: 25000,
    price: "$19.99 USD",
    badge: "25% BONUS INCLUIDO",
    desc: "Para los mánagers más competitivos. ¡Domina el mercado y las cláusulas!",
    styleClass: "cyanPack",
  },
];

export default function Shop() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const leagues = useAppSelector((s) => s.leagues.leagues);
  const activeLeagueId = useAppSelector((s) => s.leagues.activeLeagueId);
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetMessage, setFaucetMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // Determinar status de pago (success o cancel) en los params de la url
  const paymentStatus = searchParams.get("payment");

  useEffect(() => {
    // Sincronizar liga activa por defecto
    if (activeLeagueId) {
      setSelectedLeagueId(activeLeagueId);
    } else if (leagues.length > 0) {
      setSelectedLeagueId(leagues[0].id);
    }
  }, [activeLeagueId, leagues]);

  useEffect(() => {
    fetchTransactions();
  }, []);

  async function fetchTransactions() {
    setTxLoading(true);
    try {
      const data = await api<{ transactions: Transaction[] }>("/checkout/transactions");
      setTransactions(data.transactions);
    } catch (e) {
      console.error("Error fetching transactions:", e);
    } finally {
      setTxLoading(false);
    }
  }

  async function handleBuy(packageId: string) {
    setCheckoutLoading(packageId);
    try {
      const data = await api<{ url: string }>("/checkout/buy-coins", {
        method: "POST",
        body: JSON.stringify({ packageId }),
      });
      // Redirigir a Stripe Checkout
      window.location.href = data.url;
    } catch (e: any) {
      alert(e.message || "Error al iniciar el pago con Stripe");
      setCheckoutLoading(null);
    }
  }

  async function handleClaimDaily() {
    if (!selectedLeagueId) {
      setFaucetMessage({ type: "error", text: "Debes seleccionar una liga para reclamar la recompensa." });
      return;
    }
    
    // Obtener la semana del año actual (formato YYYY-Www)
    const today = new Date();
    const target = new Date(today.valueOf());
    const dayNr = (today.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const weekNum = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    const weekKey = `${today.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;

    setFaucetLoading(true);
    setFaucetMessage(null);
    try {
      const data = await api<{ success: boolean; coinsGranted: number }>("/auth/daily-reward", {
        method: "POST",
        body: JSON.stringify({
          leagueId: selectedLeagueId,
          weekKey,
        }),
      });

      // Actualizar monedas localmente en Redux
      if (user) {
        dispatch(setCoins(user.coins + data.coinsGranted));
      }
      setFaucetMessage({
        type: "success",
        text: `¡Felicidades! Reclamaste ${data.coinsGranted.toLocaleString("es-MX")} monedas.`,
      });
      fetchTransactions();
    } catch (e: any) {
      setFaucetMessage({ type: "error", text: e.message || "No se pudo reclamar la recompensa." });
    } finally {
      setFaucetLoading(false);
    }
  }

  function dismissBanner() {
    searchParams.delete("payment");
    setSearchParams(searchParams);
  }

  useEffect(() => {
    if (paymentStatus === "success") {
      dispatch(fetchMe());
      fetchTransactions();
    }
  }, [paymentStatus]);

  return (
    <div className={styles.container}>
      {/* Banner de Estado de Pago */}
      {paymentStatus === "success" && (
        <div className={`${styles.banner} ${styles.successBanner}`}>
          <div className={styles.bannerContent}>
            <IconCheck size={28} className={styles.bannerIcon} />
            <div>
              <h3>¡Compra completada con éxito!</h3>
              <p className="muted">Las monedas han sido acreditadas a tu cuenta y el registro contable se ha procesado.</p>
            </div>
          </div>
          <button className={styles.bannerClose} onClick={dismissBanner}>
            ✕
          </button>
        </div>
      )}

      {paymentStatus === "cancel" && (
        <div className={`${styles.banner} ${styles.cancelBanner}`}>
          <div className={styles.bannerContent}>
            <div className={styles.bannerIcon}>⚠️</div>
            <div>
              <h3>Pago cancelado</h3>
              <p className="muted">La transacción de Stripe fue cancelada y no se realizó ningún cobro.</p>
            </div>
          </div>
          <button className={styles.bannerClose} onClick={dismissBanner}>
            ✕
          </button>
        </div>
      )}

      <header className={styles.header}>
        <h1>Tienda de Monedas</h1>
        <p className="muted">Consigue monedas virtuales para abrir sobres y pagar cláusulas de rescisión en el mercado.</p>
        <div className={styles.balanceWidget}>
          <span className={styles.balanceLabel}>Tu Saldo actual:</span>
          <span className={styles.balanceValue}>
            {(user?.coins ?? 0).toLocaleString("es-MX")} <IconCoin size={24} className={styles.goldCoin} />
          </span>
        </div>
      </header>

      {/* Sección Faucet: Recompensa Diaria */}
      <section className={styles.faucetSection}>
        <div className={styles.faucetCard}>
          <h2>Recompensa Diaria</h2>
          <p className="muted">Reclama 100 coins gratis cada día. Si tu liga tiene alta desigualdad de riqueza y estás en el percentil inferior del 25% de tu liga, ¡recibirás un subsidio del 15% (115 coins)!</p>
          
          <div className={styles.faucetControls}>
            <div className={styles.field}>
              <label>Selecciona tu Liga:</label>
              <select 
                value={selectedLeagueId} 
                onChange={(e) => setSelectedLeagueId(e.target.value)}
                disabled={leagues.length === 0}
              >
                {leagues.length === 0 ? (
                  <option value="">No perteneces a ninguna liga</option>
                ) : (
                  leagues.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <button 
              className="primary" 
              onClick={handleClaimDaily} 
              disabled={faucetLoading || leagues.length === 0}
            >
              {faucetLoading ? "Reclamando..." : "Reclamar Recompensa"}
            </button>
          </div>

          {faucetMessage && (
            <div className={`${styles.message} ${faucetMessage.type === "success" ? styles.successMsg : styles.errorMsg}`}>
              {faucetMessage.text}
            </div>
          )}
        </div>
      </section>

      {/* Sección Tienda Stripe */}
      <section className={styles.packagesSection}>
        <h2>Paquetes de Monedas</h2>
        <div className={styles.grid}>
          {PACKS.map((pkg) => (
            <div key={pkg.id} className={`${styles.packCard} ${styles[pkg.styleClass]}`}>
              <div className={styles.cardHeader}>
                <h3>{pkg.name}</h3>
                {pkg.badge && <span className={styles.badge}>{pkg.badge}</span>}
              </div>
              <div className={styles.coinsAmount}>
                {pkg.coins.toLocaleString("es-MX")}{" "}
                <IconCoin size={28} className={styles.packageCoinIcon} />
              </div>
              <p className={styles.desc}>{pkg.desc}</p>
              <div className={styles.footerRow}>
                <span className={styles.price}>{pkg.price}</span>
                <button
                  className="primary"
                  onClick={() => handleBuy(pkg.id)}
                  disabled={checkoutLoading !== null}
                >
                  {checkoutLoading === pkg.id ? "Cargando..." : "Comprar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Sección Historial de Transacciones */}
      <section className={styles.historySection}>
        <h2>Historial de Movimientos</h2>
        {txLoading ? (
          <p className="muted">Cargando transacciones...</p>
        ) : transactions.length === 0 ? (
          <p className="muted">No hay transacciones registradas todavía.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Tipo</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isPositive = tx.amount > 0;
                  const dateStr = new Date(tx.createdAt).toLocaleDateString("es-MX", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <tr key={tx.id}>
                      <td>{dateStr}</td>
                      <td>{tx.description || "Transacción de Monedas"}</td>
                      <td>
                        <span className={`${styles.typeBadge} ${styles[tx.type.toLowerCase()]}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className={isPositive ? styles.positiveAmount : styles.negativeAmount}>
                        {isPositive ? "+" : ""}
                        {tx.amount.toLocaleString("es-MX")} <IconCoin size={14} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
