import React, { useState } from 'react';
import { LogOut, ShieldCheck, Menu, X } from 'lucide-react';
import { ROLES } from '../constants/roles';
import { getNavigationForRole } from '../config/navigationConfig';
import { Button, Badge } from './ui';

export default function AppShell({ 
  children, 
  activeTab, 
  setActiveTab, 
  currentUser, 
  onLogout 
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const userRole = currentUser?.role || ROLES.PATIENT;

  const navItems = getNavigationForRole(userRole);

  const handleNavClick = (id) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  const userName = currentUser?.profile?.name || currentUser?.email || "User";
  const userRoleLabel = userRole === ROLES.ADMIN ? "Administrator" : userRole === ROLES.DOCTOR ? "Care Coordinator" : "Patient Account";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--color-bg)" }}>
      {/* Top Header */}
      <header
        style={{
          height: "var(--header-height)",
          background: "#1A1A2E",
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "var(--shadow-sm)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="btn btn-ghost"
            style={{ display: "none", color: "#FFF", padding: 6 }}
            aria-label="Toggle navigation menu"
            id="mobile-menu-btn"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}>
            Senti<span style={{ color: "var(--color-primary)" }}>Med</span>
          </div>

          <Badge variant="primary" icon={ShieldCheck}>
            {userRole.toUpperCase()} PORTAL
          </Badge>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right", display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>{userName}</span>
            <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.6)" }}>{userRoleLabel}</span>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            icon={LogOut}
            onClick={onLogout}
            style={{ borderColor: "rgba(255,255,255,0.2)", color: "#FFFFFF" }}
          >
            Sign Out
          </Button>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, position: "relative" }}>
        {/* Desktop Sidebar */}
        <aside
          style={{
            width: "var(--sidebar-width)",
            background: "#FFFFFF",
            borderRight: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "24px 16px",
            flexShrink: 0
          }}
          className="desktop-sidebar"
        >
          <nav style={{ display: "flex", flexDirection: "column", gap: 4 }} aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: isActive ? "var(--color-primary-soft)" : "transparent",
                    color: isActive ? "var(--color-primary-dark)" : "var(--color-text)",
                    fontWeight: isActive ? 700 : 500,
                    fontSize: 13,
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div 
            style={{ 
              padding: 12, 
              background: "var(--color-bg)", 
              borderRadius: "var(--radius-sm)", 
              border: "1px solid var(--color-border)",
              fontSize: 11,
              color: "var(--color-text-muted)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "var(--color-primary-dark)", marginBottom: 4 }}>
              <ShieldCheck size={14} /> Encrypted Sandbox
            </div>
            <div>HIPAA-compliant multi-role security boundaries active.</div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              top: "var(--header-height)",
              background: "rgba(26,26,46,0.6)",
              zIndex: 99,
              display: "flex"
            }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              style={{
                width: 250,
                background: "#FFFFFF",
                height: "100%",
                padding: "20px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                boxShadow: "var(--shadow-lg)"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      borderRadius: "var(--radius-sm)",
                      border: "none",
                      background: isActive ? "var(--color-primary-soft)" : "transparent",
                      color: isActive ? "var(--color-primary-dark)" : "var(--color-text)",
                      fontWeight: activeTab === item.id ? 700 : 500,
                      fontSize: 14,
                      textAlign: "left",
                      cursor: "pointer"
                    }}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Content Area */}
        <main
          style={{
            flex: 1,
            padding: "32px",
            overflowY: "auto",
            maxWidth: 1200,
            margin: "0 auto",
            width: "100%"
          }}
        >
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar {
            display: none !important;
          }
          #mobile-menu-btn {
            display: inline-flex !important;
          }
          main {
            padding: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}
