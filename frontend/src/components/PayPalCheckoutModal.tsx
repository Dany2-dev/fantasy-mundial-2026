import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAppSelector } from "../store/store";
import { IconClose, IconCoin, IconShield } from "./icons";
import styles from "./PayPalCheckoutModal.module.css";

interface CartItemDetail {
  packageId: string;
  quantity: number;
  pkg: {
    name: string;
    coins: number;
    priceLabel: string;
    priceMXN: number;
  };
  itemCoins: number;
  itemPriceMXN: number;
}

interface PayPalCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: { packageId: string; quantity: number }[];
  cartDetails: CartItemDetail[];
  totalCartCoins: number;
  totalCartMXN: number;
  onSuccess: (coinsGranted: number) => void;
}

export default function PayPalCheckoutModal({
  isOpen,
  onClose,
  cartItems,
  cartDetails,
  totalCartCoins,
  totalCartMXN,
  onSuccess,
}: PayPalCheckoutModalProps) {
  const user = useAppSelector((s) => s.auth.user);

  // 1. Datos del Usuario
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // 2. Estado de Orden PayPal
  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null);
  const [approveUrl, setApproveUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      setFullName(user.name || "");
      setEmail(user.email || "");
      setErrorMsg(null);
      setPaypalOrderId(null);
      setApproveUrl(null);
    }
  }, [isOpen, user]);

  useEffect(() => {
    function processApproval(orderId?: string) {
      const targetId = orderId || paypalOrderId;
      if (targetId) {
        handleCaptureOrder(targetId);
      }
    }

    function handlePayPalMessage(event: MessageEvent) {
      if (event.data && event.data.type === "PAYPAL_APPROVED") {
        processApproval(event.data.orderId);
      }
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === "paypal_success_event" && event.newValue) {
        try {
          const data = JSON.parse(event.newValue);
          processApproval(data.orderId);
        } catch (e) {}
      }
    }

    window.addEventListener("message", handlePayPalMessage);
    window.addEventListener("storage", handleStorage);

    let bc: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      bc = new BroadcastChannel("paypal_checkout");
      bc.onmessage = (event) => {
        if (event.data && event.data.type === "PAYPAL_APPROVED") {
          processApproval(event.data.orderId);
        }
      };
    }

    return () => {
      window.removeEventListener("message", handlePayPalMessage);
      window.removeEventListener("storage", handleStorage);
      if (bc) bc.close();
    };
  }, [paypalOrderId, fullName, email, phone, address, cartItems]);

  if (!isOpen) return null;

  // Abrir Ventana de PayPal Oficial para reflejar en Dashboard de PayPal
  async function handleOpenPayPalWindow() {
    if (!fullName.trim() || !email.trim()) {
      setErrorMsg("Por favor completa tu Nombre Completo y Correo Electrónico.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const customerInfo = {
      name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
    };

    try {
      const createRes = await api<{ paypalOrderId: string; approveUrl: string | null }>(
        "/checkout/paypal/create-order",
        {
          method: "POST",
          body: JSON.stringify({ items: cartItems, customerInfo }),
        }
      );

      setPaypalOrderId(createRes.paypalOrderId);

      if (createRes.approveUrl) {
        setApproveUrl(createRes.approveUrl);
        // Abrir popup de PayPal
        window.open(createRes.approveUrl, "PayPalCheckout", "width=550,height=700,top=100,left=100");
      } else {
        // Ejecutar captura directa
        await handleCaptureOrder(createRes.paypalOrderId, customerInfo);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al crear la orden en PayPal.");
    } finally {
      setLoading(false);
    }
  }

  // Confirmar y capturar cobro de la orden
  async function handleCaptureOrder(orderId?: string, custInfo?: any) {
    const targetOrderId = orderId || paypalOrderId;
    if (!targetOrderId) return;

    setLoading(true);
    setErrorMsg(null);

    const customerInfo = custInfo || {
      name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
    };

    try {
      const captureRes = await api<{ success: boolean; coinsGranted: number }>(
        "/checkout/paypal/capture-order",
        {
          method: "POST",
          body: JSON.stringify({
            orderId: targetOrderId,
            items: cartItems,
            customerInfo,
          }),
        }
      );

      if (captureRes.success) {
        onSuccess(captureRes.coinsGranted);
        onClose();
      } else {
        setErrorMsg("No se pudo capturar la transacción de PayPal.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al capturar el pago en la API de PayPal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className={styles.modalHeader}>
          <div className={styles.headerTitleBox}>
            <div className={styles.paypalBadge}>
              <span className={styles.paypalText}>Pay</span>
              <span className={styles.paypalTextAccent}>Pal</span>
            </div>
            <h2>Pasarela de Pago PayPal API</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar modal">
            <IconClose size={20} />
          </button>
        </header>

        <div className={styles.modalBody}>
          {/* Resumen de la orden */}
          <div className={styles.orderSummaryBox}>
            <div className={styles.summaryHeader}>
              <span>Resumen de Lista ({cartItems.length} paquetes)</span>
              <span className={styles.coinsGrantedText}>
                +{totalCartCoins.toLocaleString("es-MX")} <IconCoin size={14} />
              </span>
            </div>
            <div className={styles.summaryItemsRow}>
              {cartDetails.map((item) => (
                <span key={item.packageId} className={styles.itemChip}>
                  {item.quantity}x {item.pkg.name}
                </span>
              ))}
            </div>
            <div className={styles.totalPayRow}>
              <span>Total a Pagar en Pesos:</span>
              <strong className={styles.totalAmount}>${totalCartMXN.toFixed(2)} MXN</strong>
            </div>
          </div>

          <div className={styles.form}>
            {/* Datos del Comprador */}
            <div className={styles.sectionHeader}>
              <h3>1. Datos del Comprador</h3>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Nombre Completo *</label>
                <input
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label>Correo Electrónico *</label>
                <input
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label>Teléfono de Contacto</label>
                <input
                  type="tel"
                  placeholder="+52 55 1234 5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label>Dirección / Ciudad</label>
                <input
                  type="text"
                  placeholder="Ciudad de México"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>

            {/* Pago con Ventana Oficial de PayPal */}
            <div className={styles.paypalOfficialBox}>
              <div className={styles.paypalBoxTitle}>
                <span>Pago Oficial con Ventana Emergente de PayPal</span>
              </div>

              <button
                type="button"
                className={styles.paypalWindowBtn}
                onClick={handleOpenPayPalWindow}
                disabled={loading}
              >
                <span>{loading ? "Procesando orden..." : `Pagar $${totalCartMXN.toFixed(2)} MXN con`}</span>
                <span className={styles.btnPaypalBadge}>
                  <span className={styles.paypalText}>Pay</span>
                  <span className={styles.paypalTextAccent}>Pal</span>
                </span>
              </button>

              {approveUrl && (
                <div className={styles.approveStatusCard}>
                  <p>🟢 Ventana de PayPal emergente abierta. Al autorizar el pago en PayPal, haz clic en el botón de abajo:</p>
                  <button
                    type="button"
                    className={styles.confirmCaptureBtn}
                    onClick={() => handleCaptureOrder()}
                    disabled={loading}
                  >
                    {loading ? "Capturando cobro en PayPal..." : "Confirmar y Acreditar Monedas"}
                  </button>
                </div>
              )}
            </div>

            {errorMsg && <div className={styles.errorBox}>{errorMsg}</div>}

            <div className={styles.paymentFooter}>
              <p className={styles.securityNote}>
                <IconShield size={16} /> Pago 100% seguro procesado mediante **PayPal REST API v2**.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
