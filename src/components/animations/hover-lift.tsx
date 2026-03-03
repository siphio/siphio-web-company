"use client";

import { motion } from "motion/react";

export function HoverLiftCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      whileHover={{
        y: -4,
        boxShadow: "0 12px 40px rgba(0, 0, 0, 0.12)",
      }}
      transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function HoverScaleButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.button
      className={className}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "tween", duration: 0.15 }}
    >
      {children}
    </motion.button>
  );
}
