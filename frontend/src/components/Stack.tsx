// Adaptado de React Bits (Stack) a TypeScript + CSS Modules. Se usa para las
// ofertas de club (cantera, préstamo, mercado…) en Tu Leyenda: arrastrar una
// carta la manda al fondo para ver la siguiente, y tocar la de encima
// confirma esa elección (a diferencia del original, que solo reordena).
import { motion, useMotionValue, useTransform } from "motion/react";
import { ReactNode, useEffect, useState } from "react";
import styles from "./Stack.module.css";

interface CardRotateProps {
  children: ReactNode;
  onSendToBack: () => void;
  sensitivity: number;
}

function CardRotate({ children, onSendToBack, sensitivity }: CardRotateProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [60, -60]);
  const rotateY = useTransform(x, [-100, 100], [-60, 60]);

  function handleDragEnd(_: unknown, info: { offset: { x: number; y: number } }) {
    if (Math.abs(info.offset.x) > sensitivity || Math.abs(info.offset.y) > sensitivity) {
      onSendToBack();
    } else {
      x.set(0);
      y.set(0);
    }
  }

  return (
    <motion.div
      className={styles.cardRotate}
      style={{ x, y, rotateX, rotateY }}
      drag
      dragConstraints={{ top: 0, right: 0, bottom: 0, left: 0 }}
      dragElastic={0.6}
      whileTap={{ cursor: "grabbing" }}
      onDragEnd={handleDragEnd}
    >
      {children}
    </motion.div>
  );
}

export interface StackCard {
  id: string;
  content: ReactNode;
}

interface StackProps {
  cards: StackCard[];
  onSelect: (id: string) => void;
  randomRotation?: boolean;
  sensitivity?: number;
  animationConfig?: { stiffness: number; damping: number };
}

export default function Stack({
  cards,
  onSelect,
  randomRotation = true,
  sensitivity = 140,
  animationConfig = { stiffness: 260, damping: 20 },
}: StackProps) {
  const [order, setOrder] = useState(cards.map((c) => c.id));

  // Si cambian las cartas (nuevo evento), reinicia el orden.
  useEffect(() => {
    setOrder(cards.map((c) => c.id));
  }, [cards]);

  const sendToBack = (id: string) => {
    setOrder((prev) => {
      const next = [...prev];
      const i = next.indexOf(id);
      if (i === -1) return prev;
      next.splice(i, 1);
      next.unshift(id);
      return next;
    });
  };

  const byId = new Map(cards.map((c) => [c.id, c]));

  return (
    <div className={styles.stackContainer}>
      {order.map((id, index) => {
        const card = byId.get(id);
        if (!card) return null;
        const isTop = index === order.length - 1;
        const randomRotate = randomRotation ? Math.random() * 6 - 3 : 0;
        return (
          <CardRotate key={card.id} onSendToBack={() => sendToBack(card.id)} sensitivity={sensitivity}>
            <motion.div
              className={styles.card}
              onClick={() => (isTop ? onSelect(card.id) : sendToBack(card.id))}
              animate={{
                rotateZ: (order.length - index - 1) * 4 + randomRotate,
                scale: 1 + index * 0.06 - order.length * 0.06,
                transformOrigin: "90% 90%",
              }}
              initial={false}
              transition={{ type: "spring", stiffness: animationConfig.stiffness, damping: animationConfig.damping }}
            >
              {card.content}
            </motion.div>
          </CardRotate>
        );
      })}
    </div>
  );
}
