import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function PayPalCallback() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token") || searchParams.get("orderId");
    const isSuccess = searchParams.get("payment") === "paypal_success" || !!token;

    if (isSuccess) {
      // 1. BroadcastChannel
      if ("BroadcastChannel" in window) {
        try {
          const bc = new BroadcastChannel("paypal_checkout");
          bc.postMessage({ type: "PAYPAL_APPROVED", orderId: token });
          bc.close();
        } catch (e) {
          console.error(e);
        }
      }

      // 2. localStorage event
      try {
        localStorage.setItem("paypal_success_event", JSON.stringify({ orderId: token, time: Date.now() }));
      } catch (e) {
        console.error(e);
      }

      // 3. postMessage a ventana opener
      if (window.opener) {
        try {
          window.opener.postMessage({ type: "PAYPAL_APPROVED", orderId: token }, "*");
        } catch (e) {
          console.error(e);
        }
      }

      // 4. Cerrar la ventana emergente automáticamente
      const timer = setTimeout(() => {
        try {
          window.close();
        } catch (e) {
          console.error(e);
        }
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "#0b0f19",
        color: "#f8fafc",
        fontFamily: "system-ui, -apple-system, sans-serif",
        textAlign: "center",
        padding: "24px",
      }}
    >
      <div style={{ fontSize: "56px", marginBottom: "16px" }}>🟢</div>
      <h2 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "8px" }}>¡Pago Autorizado en PayPal!</h2>
      <p style={{ color: "#94a3b8", fontSize: "14px", maxWidth: "320px", lineHeight: "1.5" }}>
        Procesando acreditación de monedas y cerrando esta ventana automáticamente...
      </p>
    </div>
  );
}
