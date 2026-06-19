"use client";

import React from "react";
import { motion } from "framer-motion";

const ease = [0.16, 1, 0.3, 1] as const;

type Props = {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  /** Render as a list item / different element if needed. */
  as?: "div" | "li" | "article" | "section";
};

/** Scroll-into-view reveal used across the app for a fluid, premium feel. */
export default function Reveal({ children, delay = 0, y = 24, className = "", as = "div" }: Props) {
  const MotionTag = motion[as] as typeof motion.div;
  return (
    <MotionTag
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease }}
      className={className}
    >
      {children}
    </MotionTag>
  );
}

/** Staggered container — children fade up in sequence as they enter the viewport. */
export function RevealStagger({
  children,
  className = "",
  stagger = 0.06
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={{ show: { transition: { staggerChildren: stagger } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
