"use client";

import { AnimatePresence, motion } from "framer-motion";
import SuccessAlert from "@/components/SuccessAlert";
import ErrorAlert from "@/components/ErrorAlert";
import PasswordAlert from "@/components/PasswordAlert";
import { LoginAlert } from "../types";

const variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export default function LoginAlerts({ alert }: { alert: LoginAlert }) {
  return (
    <AnimatePresence>
      {alert === "success" && (
        <motion.div
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <SuccessAlert />
        </motion.div>
      )}

      {alert === "error" && (
        <motion.div
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <ErrorAlert />
        </motion.div>
      )}

      {alert === "password" && (
        <motion.div
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <PasswordAlert />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
