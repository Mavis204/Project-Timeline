/**
 * TopBar.jsx — Global top navigation bar
 *
 * This component is ALWAYS visible and displays:
 * - App logo/title on the left
 * - User email + avatar with dropdown menu on the right
 * - Logout button
 *
 * Props:
 *   - user: { email, ... } (from authentication)
 *   - onLogout: () => void
 */

import React, { useState, useRef, useEffect } from "react";

export default function TopBar({ user, onLogout, onNavigateDashboard }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Get first letter of email for avatar
  const emailInitial = user?.email?.charAt(0).toUpperCase() || "?";

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      style={{
        height: "60px",
        background: "#ffffff",
        borderBottom: "1px solid #e2e8f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        flexShrink: 0,
        zIndex: 100,
      }}
    >
      {/* Left: Logo and Title */}
      <div
        onClick={onNavigateDashboard}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            background: "linear-gradient(135deg, #2563eb, #4f46e5)",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              color: "white",
              fontSize: "13px",
              fontWeight: "800",
              letterSpacing: "-0.5px",
            }}
          >
            BA
          </span>
        </div>
        <div>
          <img
            src="/timeline_logo_final.svg"
            alt="Timeline"
            style={{
              height: 32,
              width: "auto",
              display: "block",
            }}
          />
          <div
            style={{
              fontSize: "11px",
              color: "#94a3b8",
              marginTop: "2px",
            }}
          >
            Tracker
          </div>
        </div>
      </div>

      {/* Right: User Menu */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* User Info + Avatar Dropdown */}
        <div ref={dropdownRef} style={{ position: "relative" }}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: dropdownOpen ? "#f0f4f8" : "transparent",
              border: "none",
              borderRadius: "8px",
              padding: "6px 10px",
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (!dropdownOpen) e.currentTarget.style.background = "#f8fafc";
            }}
            onMouseLeave={(e) => {
              if (!dropdownOpen)
                e.currentTarget.style.background = "transparent";
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                fontSize: "13px",
              }}
            >
              <div
                style={{
                  color: "#1e293b",
                  fontWeight: "600",
                  lineHeight: 1.2,
                }}
              >
                {user?.email || "User"}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#94a3b8",
                  marginTop: "2px",
                }}
              >
                Account
              </div>
            </div>

            {/* Avatar Circle */}
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #2563eb, #4f46e5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: "700",
                fontSize: "14px",
                boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)",
                flexShrink: 0,
              }}
            >
              {emailInitial}
            </div>

            {/* Dropdown Arrow */}
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              style={{
                color: "#94a3b8",
                transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.15s ease",
                flexShrink: 0,
              }}
            >
              <path
                d="M2.5 4.5L6 8L9.5 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.12)",
                zIndex: 1000,
                minWidth: "200px",
                overflow: "hidden",
              }}
            >
              {/* Email info */}
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #e2e8f0",
                  fontSize: "12px",
                }}
              >
                <div style={{ color: "#64748b", marginBottom: "4px" }}>
                  Logged in as
                </div>
                <div
                  style={{
                    color: "#1e293b",
                    fontWeight: "600",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {user?.email}
                </div>
              </div>

              {/* Logout button */}
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  onLogout();
                }}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "transparent",
                  border: "none",
                  fontSize: "13px",
                  color: "#ef4444",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#fef2f2";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  style={{ flexShrink: 0 }}
                >
                  <path
                    d="M10 3l3 3-3 3M13 6H4m6 6v1H3V2h7v1"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
