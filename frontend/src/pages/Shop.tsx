import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAppDispatch, useAppSelector } from "../store/store";
import { fetchMe, setCoins } from "../store/authSlice";
import {
  IconCoin,
  IconCheck,
  IconShoppingCart,
  IconTrash,
  IconPlus,
  IconMinus,
} from "../components/icons";
import PayPalCheckoutModal from "../components/PayPalCheckoutModal";
import styles from "./Shop.module.css";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  referenceId: string | null;
  description: string | null;
  createdAt: string;
}

export interface CartItem {
  packageId: string;
  quantity: number;
}

const PACKS = [
  {
    id: "coins-pack-small",
    name: "Bolsa de 5 Millones",
    coins: 5000000,
    priceLabel: "$25.00 MXN",
    priceMXN: 25,
    badge: null,
    desc: "Perfecta para comprar tus primeros sobres de bronce y plata.",
    styleClass: "bronzePack",
  },
  {
    id: "coins-pack-medium",
    name: "Cofre de 12 Millones",
    coins: 12000000,
    priceLabel: "$50.00 MXN",
    priceMXN: 50,
    badge: "20% BONUS INCLUIDO",
    desc: "Excelente valor para expandir tu plantilla y asegurar jugadores oro.",
    styleClass: "goldPack",
  },
  {
    id: "coins-pack-large",
    name: "Caja Fuerte de 28 Millones",
    coins: 28000000,
    priceLabel: "$100.00 MXN",
    priceMXN: 100,
    badge: "40% BONUS INCLUIDO",
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

  // Carrito / Lista de Pedidos
  const [cart, setCart] = useState<CartItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPayPalModalOpen, setIsPayPalModalOpen] = useState(false);

  const paymentStatus = searchParams.get("payment");

  useEffect(() => {
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

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2500);
  }

  function addToCart(packageId: string) {
    const pkg = PACKS.find((p) => p.id === packageId);
    setCart((prev) => {
      const existing = prev.find((item) => item.packageId === packageId);
      if (existing) {
        return prev.map((item) =>
          item.packageId === packageId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { packageId, quantity: 1 }];
    });
    if (pkg) {
      showToast(`¡${pkg.name} agregado a tu lista!`);
    }
  }

  function updateQuantity(packageId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.packageId === packageId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  }

  function removeFromCart(packageId: string) {
    setCart((prev) => prev.filter((item) => item.packageId !== packageId));
  }

  function clearCart() {
    setCart([]);
  }

  const cartDetails = cart.map((item) => {
    const pkg = PACKS.find((p) => p.id === item.packageId)!;
    return {
      ...item,
      pkg,
      itemCoins: pkg.coins * item.quantity,
      itemPriceMXN: pkg.priceMXN * item.quantity,
    };
  });

  const totalCartCoins = cartDetails.reduce((sum, item) => sum + item.itemCoins, 0);
  const totalCartMXN = cartDetails.reduce((sum, item) => sum + item.itemPriceMXN, 0);
  const totalCartItemsCount = cartDetails.reduce((sum, item) => sum + item.quantity, 0);

  function handleCheckoutCart() {
    if (cart.length === 0) return;
    setIsPayPalModalOpen(true);
  }

  function handlePayPalSuccess(coinsGranted: number) {
    if (user) {
      dispatch(setCoins(user.coins + coinsGranted));
    }
    setCart([]);
    fetchTransactions();
    showToast(`¡Pago exitoso con PayPal! Acreditadas ${coinsGranted.toLocaleString("es-MX")} monedas.`);
  }

  async function handleClaimDaily() {
    if (!selectedLeagueId) {
      setFaucetMessage({ type: "error", text: "Debes seleccionar una liga para reclamar la recompensa." });
      return;
    }
    
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
    const token = searchParams.get("token") || searchParams.get("orderId");
    const isPayPalReturn = paymentStatus === "paypal_success" || paymentStatus === "success" || !!token;

    // Detectar si la ejecución actual ocurre dentro del Pop-up emergente de PayPal
    const isPopup = window.name === "PayPalCheckout" || (window.opener && window.opener !== window);

    if (isPopup && isPayPalReturn) {
      // 1. Notificar por BroadcastChannel
      if ("BroadcastChannel" in window) {
        try {
          const bc = new BroadcastChannel("paypal_checkout");
          bc.postMessage({ type: "PAYPAL_APPROVED", orderId: token });
          bc.close();
        } catch (e) {}
      }

      // 2. Notificar por evento de localStorage
      try {
        localStorage.setItem("paypal_success_event", JSON.stringify({ orderId: token, time: Date.now() }));
      } catch (e) {}

      // 3. Notificar por postMessage a la ventana padre
      if (window.opener) {
        try {
          window.opener.postMessage({ type: "PAYPAL_APPROVED", orderId: token }, "*");
        } catch (e) {}
      }

      // 4. Cerrar la ventana emergente automáticamente
      setTimeout(() => {
        window.close();
      }, 100);
      return;
    }

    // Si la redirección ocurre en la misma ventana principal
    if (token && isPayPalReturn) {
      api<{ success: boolean; coinsGranted: number; orderId: string }>("/checkout/paypal/capture-order", {
        method: "POST",
        body: JSON.stringify({ orderId: token }),
      })
        .then((res) => {
          if (res.success) {
            dispatch(fetchMe());
            fetchTransactions();
            showToast(`¡Pago exitoso con PayPal! Acreditadas ${res.coinsGranted.toLocaleString("es-MX")} monedas.`);
          }
        })
        .catch((err) => console.error("Error al auto-capturar orden de PayPal:", err));
    } else if (isPayPalReturn) {
      dispatch(fetchMe());
      fetchTransactions();
    }
  }, [paymentStatus, searchParams]);

  return (
    <div className={styles.container}>
      {/* Toast flotante de confirmación */}
      {toastMessage && (
        <div className={styles.toastNotification}>
          <IconCheck size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Banner de Estado de Pago */}
      {(paymentStatus === "success" || paymentStatus === "paypal_success") && (
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
              <p className="muted">La transacción fue cancelada y no se realizó ningún cobro.</p>
            </div>
          </div>
          <button className={styles.bannerClose} onClick={dismissBanner}>
            ✕
          </button>
        </div>
      )}

      <header className={styles.header}>
        <h1>Tienda de Monedas</h1>
        <p className="muted">Selecciona los paquetes de monedas en pesos (MXN), agrégalos a tu lista de compra y confirma tu pedido.</p>
        <div className={styles.balanceWidget}>
          <span className={styles.balanceLabel}>Tu Saldo actual:</span>
          <span className={styles.balanceValue}>
            {(Number(user?.coins) || 0).toLocaleString("es-MX")} <IconCoin size={24} className={styles.goldCoin} />
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

      {/* Sección Tienda: Catálogo de Paquetes */}
      <section className={styles.packagesSection}>
        <div className={styles.sectionTitleRow}>
          <h2>Paquetes Disponibles</h2>
          <span className={styles.currencyBadge}>Precios accesibles en Pesos (MXN)</span>
        </div>
        <div className={styles.grid}>
          {PACKS.map((pkg) => {
            const inCart = cart.find((item) => item.packageId === pkg.id);
            return (
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
                  <span className={styles.price}>{pkg.priceLabel}</span>
                  <button
                    className={`${styles.addBtn} ${inCart ? styles.addBtnActive : ""}`}
                    onClick={() => addToCart(pkg.id)}
                  >
                    <IconPlus size={16} />
                    {inCart ? `Agregar otro (${inCart.quantity})` : "Agregar a la lista"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sección Lista de Pedidos / Carrito de Compras */}
      <section className={styles.cartSection} id="lista-de-compras">
        <div className={styles.cartHeader}>
          <div className={styles.cartTitleBox}>
            <IconShoppingCart size={24} className={styles.cartHeaderIcon} />
            <h2>Lista de Pedido ({totalCartItemsCount})</h2>
          </div>
          {cart.length > 0 && (
            <button className={styles.clearBtn} onClick={clearCart}>
              <IconTrash size={16} /> Vaciar lista
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <div className={styles.cartEmptyCard}>
            <IconShoppingCart size={40} className={styles.emptyCartIcon} />
            <h3>Tu lista de compras está vacía</h3>
            <p className="muted">Explora los paquetes arriba y haz clic en <strong>"Agregar a la lista"</strong> para armar tu pedido.</p>
          </div>
        ) : (
          <div className={styles.cartContentGrid}>
            <div className={styles.cartItemsList}>
              {cartDetails.map((item) => (
                <div key={item.packageId} className={styles.cartItemRow}>
                  <div className={styles.itemInfo}>
                    <h4>{item.pkg.name}</h4>
                    <span className={styles.itemCoinBadge}>
                      +{item.itemCoins.toLocaleString("es-MX")} <IconCoin size={14} />
                    </span>
                  </div>
                  <div className={styles.itemUnitPrice}>
                    <span className="muted">{item.pkg.priceLabel} c/u</span>
                  </div>
                  <div className={styles.qtyControl}>
                    <button
                      className={styles.qtyBtn}
                      onClick={() => updateQuantity(item.packageId, -1)}
                      title="Disminuir"
                    >
                      <IconMinus size={14} />
                    </button>
                    <span className={styles.qtyValue}>{item.quantity}</span>
                    <button
                      className={styles.qtyBtn}
                      onClick={() => updateQuantity(item.packageId, 1)}
                      title="Aumentar"
                    >
                      <IconPlus size={14} />
                    </button>
                  </div>
                  <div className={styles.itemSubtotal}>
                    <span>${item.itemPriceMXN.toFixed(2)} MXN</span>
                  </div>
                  <button
                    className={styles.removeBtn}
                    onClick={() => removeFromCart(item.packageId)}
                    title="Eliminar de la lista"
                  >
                    <IconTrash size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Resumen y Botón de Pago */}
            <div className={styles.cartSummaryCard}>
              <h3>Resumen del Pedido</h3>
              <div className={styles.summaryRow}>
                <span>Items seleccionados:</span>
                <strong>{totalCartItemsCount}</strong>
              </div>
              <div className={styles.summaryRow}>
                <span>Monedas a acreditar:</span>
                <strong className={styles.summaryCoins}>
                  +{totalCartCoins.toLocaleString("es-MX")} <IconCoin size={16} />
                </strong>
              </div>
              <div className={styles.summaryDivider} />
              <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                <span>Total a Pagar:</span>
                <span className={styles.totalMXN}>${totalCartMXN.toFixed(2)} MXN</span>
              </div>
              <button
                className={`primary ${styles.checkoutBtn}`}
                onClick={handleCheckoutCart}
              >
                Proceder al Pago (${totalCartMXN.toFixed(2)} MXN)
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Modal Checkout PayPal */}
      <PayPalCheckoutModal
        isOpen={isPayPalModalOpen}
        onClose={() => setIsPayPalModalOpen(false)}
        cartItems={cart}
        cartDetails={cartDetails}
        totalCartCoins={totalCartCoins}
        totalCartMXN={totalCartMXN}
        onSuccess={handlePayPalSuccess}
      />

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
