import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Modal, Button } from './index';

export function Drawer({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "lg",
  isDirty = false
}) {
  const shouldReduceMotion = useReducedMotion();
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const handleBackdropClick = () => {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      onClose();
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardDialog(false);
    onClose();
  };

  const drawerWidths = {
    md: 440,
    lg: 560,
    full: "100%"
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", justifyContent: "flex-end" }}>
            {/* Subtle Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleBackdropClick}
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(26, 26, 46, 0.4)",
                backdropFilter: "blur(2px)"
              }}
            />

            {/* Drawer Body */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { x: "100%" }}
              animate={shouldReduceMotion ? { opacity: 1 } : { x: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { x: "100%" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "relative",
                width: drawerWidths[size] || 560,
                maxWidth: "100vw",
                height: "100vh",
                backgroundColor: "var(--color-surface)",
                boxShadow: "-8px 0 32px rgba(0, 0, 0, 0.15)",
                display: "flex",
                flexDirection: "column",
                zIndex: 1000,
                overflow: "hidden"
              }}
            >
              {/* Header */}
              <div 
                style={{ 
                  padding: "20px 24px", 
                  borderBottom: "1px solid var(--color-border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  backgroundColor: "var(--color-surface)"
                }}
              >
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1A1A2E" }}>{title}</h2>
                  {description && (
                    <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 2 }}>
                      {description}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleBackdropClick}
                  style={{
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    padding: 6,
                    borderRadius: 8,
                    color: "var(--color-text-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                  aria-label="Close Drawer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Content Body */}
              <div 
                style={{ 
                  flex: 1, 
                  overflowY: "auto", 
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 20
                }}
              >
                {children}
              </div>

              {/* Sticky Footer */}
              {footer && (
                <div 
                  style={{ 
                    padding: "16px 24px", 
                    borderTop: "1px solid var(--color-border)", 
                    backgroundColor: "var(--color-surface)",
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    gap: 12,
                    boxShadow: "0 -4px 16px rgba(0,0,0,0.04)"
                  }}
                >
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Discard Confirmation Modal */}
      <Modal isOpen={showDiscardDialog} onClose={() => setShowDiscardDialog(false)} title="Discard appointment request?">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
            You have unsaved changes in your appointment request form. Are you sure you want to discard them?
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button variant="outline" onClick={() => setShowDiscardDialog(false)}>
              Keep Editing
            </Button>
            <Button variant="danger" onClick={handleConfirmDiscard}>
              Discard Request
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
