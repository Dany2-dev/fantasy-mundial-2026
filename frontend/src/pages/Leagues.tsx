import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import { createLeague, joinLeague, setActiveLeague } from "../store/leagueSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { Standing } from "../types";
import styles from "./Leagues.module.css";

export default function Leagues() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const { leagues, activeLeagueId } = useAppSelector((s) => s.leagues);

  const [newName, setNewName] = useState("");
  const [code, setCode] = useState("");
  const [standings, setStandings] = useState<Standing[]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const activeLeague = leagues.find((l) => l.id === activeLeagueId);

  useEffect(() => {
    if (activeLeagueId) {
      api<{ standings: Standing[] }>(`/leagues/${activeLeagueId}`)
        .then((d) => setStandings(d.standings))
        .catch(() => setStandings([]));
    } else {
      setStandings([]);
    }
  }, [activeLeagueId, leagues.length]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const result = await dispatch(createLeague(newName));
    if (createLeague.fulfilled.match(result)) {
      setNewName("");
      setMsg({ kind: "ok", text: `Liga creada. Comparte el código ${result.payload.inviteCode}` });
    } else {
      setMsg({ kind: "error", text: result.error.message ?? "No se pudo crear la liga" });
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const result = await dispatch(joinLeague(code));
    if (joinLeague.fulfilled.match(result)) {
      setCode("");
      setMsg({ kind: "ok", text: `Ya estás en ${result.payload.name} 🎉` });
    } else {
      setMsg({ kind: "error", text: result.error.message ?? "No se pudo unir a la liga" });
    }
  }

  function copyCode() {
    if (!activeLeague) return;
    navigator.clipboard.writeText(activeLeague.inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div>
      <h1>Ligas</h1>

      <div className={styles.forms}>
        <form onSubmit={handleCreate} className={styles.formCard}>
          <h3>Crear liga</h3>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre de tu liga"
            minLength={3}
            required
          />
          <button className="primary" type="submit">
            Crear liga
          </button>
        </form>

        <form onSubmit={handleJoin} className={styles.formCard}>
          <h3>Unirme con código</h3>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABX4T9"
            maxLength={6}
            className={styles.codeInput}
            required
          />
          <button className="primary" type="submit">
            Unirme
          </button>
        </form>
      </div>

      {msg && <p className={msg.kind === "ok" ? "ok-text" : "error-text"}>{msg.text}</p>}

      {leagues.length > 0 && (
        <section className={styles.section}>
          <h2>Mis ligas</h2>
          <div className={styles.leagueList}>
            {leagues.map((l) => (
              <button
                key={l.id}
                className={`${styles.leagueItem} ${l.id === activeLeagueId ? styles.leagueActive : ""}`}
                onClick={() => dispatch(setActiveLeague(l.id))}
              >
                <strong>{l.name}</strong>
                <span className="caption">
                  {l.id === activeLeagueId ? "Liga activa" : "Tocar para activar"}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {activeLeague && (
        <section className={styles.section}>
          <div className={styles.standingsHeader}>
            <h2>Clasificación — {activeLeague.name}</h2>
            <button className="ghost" onClick={copyCode}>
              {copied ? "¡Copiado!" : `Código: ${activeLeague.inviteCode} 📋`}
            </button>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Mánager</th>
                <th className={styles.num}>Puntos</th>
                <th className={styles.num}>Cartas</th>
                <th className={styles.num}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.userId} className={s.userId === user?.id ? styles.me : ""}>
                  <td className="tabular">{i === 0 ? "🏆" : `${i + 1}`}</td>
                  <td>
                    {s.name}
                    {s.userId === user?.id && <span className={styles.youTag}> (tú)</span>}
                  </td>
                  <td className={`${styles.num} tabular`}>{s.points.toLocaleString("es-MX")}</td>
                  <td className={`${styles.num} tabular`}>{s.cardCount}</td>
                  <td className={`${styles.num} tabular`}>{s.teamValue.toLocaleString("es-MX")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="caption">
            Valor = suma de medias de tus cartas. Los puntos llegarán con las jornadas del torneo.
          </p>
        </section>
      )}
    </div>
  );
}
