/**
 * client/src/components/AuthScreen.jsx
 *
 * Login and register screen with modern split-panel UI
 */

import { useState } from "react";
import { login, register } from "../services/auth";

/* ─── INPUT STYLES ─────────────────────────────────────────────────────────── */
const inputStyle = {
  height: 44,
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  padding: "0 14px",
  fontSize: 14,
  background: "#f9fafb",
  outline: "none",
  transition: "all .18s ease",
  fontFamily: "inherit",
};

function focusInput(e) {
  e.currentTarget.style.borderColor = "#4f46e5";
  e.currentTarget.style.background = "#fff";
  e.currentTarget.style.boxShadow = "0 0 0 3px #eef2ff";
}

function blurInput(e) {
  e.currentTarget.style.borderColor = "#e5e7eb";
  e.currentTarget.style.background = "#f9fafb";
  e.currentTarget.style.boxShadow = "none";
}

/* ─── LOGIN BUTTON STYLES ──────────────────────────────────────────────────── */
const loginBtn = {
  marginTop: 20,
  width: "100%",
  height: 44,
  borderRadius: 12,
  border: "none",
  background: "#4f46e5",
  color: "#fff",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  transition: "all .18s ease",
  boxShadow: "0 6px 18px rgba(79,70,229,0.18)",
  fontFamily: "inherit",
};

function hoverLogin(e) {
  e.currentTarget.style.background = "#4338ca";
  e.currentTarget.style.transform = "translateY(-1px)";
  e.currentTarget.style.boxShadow = "0 8px 24px rgba(79,70,229,0.22)";
}

function leaveLogin(e) {
  e.currentTarget.style.background = "#4f46e5";
  e.currentTarget.style.transform = "translateY(0)";
  e.currentTarget.style.boxShadow = "0 6px 18px rgba(79,70,229,0.18)";
}

function pressLogin(e) {
  e.currentTarget.style.transform = "translateY(1px) scale(0.97)";
  e.currentTarget.style.boxShadow = "0 2px 6px rgba(79,70,229,0.18)";
}

function releaseLogin(e) {
  e.currentTarget.style.transform = "translateY(-1px)";
  e.currentTarget.style.boxShadow = "0 8px 24px rgba(79,70,229,0.22)";
}

export default function AuthScreen({ onSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        setSuccess("Logged in successfully!");
      } else {
        await register(email, password);
        setSuccess("Account created! Welcome to Project Timeline!");
        setTimeout(() => {
          setIsLogin(true);
          setSuccess("");
        }, 1500);
      }
      setTimeout(() => onSuccess(), isLogin ? 500 : 2000);
    } catch (err) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "#f8fafc",
      }}
    >
      {/* LEFT PANEL */}
      <div
        style={{
          flex: 1,
          background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
          color: "#fff",
          padding: "60px 50px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <img
            src="/timeline_logo_final.svg"
            alt="Timeline"
            style={{
              height: 60,
              width: "auto",
              marginBottom: 24,
              display: "block",
            }}
          />

          <div
            style={{
              marginTop: 12,
              fontSize: 16,
              opacity: 0.85,
              lineHeight: 1.6,
            }}
          >
            Plan, track, and visualize your projects with clarity and precision.
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div
        style={{
          width: 420,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <div style={{ width: "100%" }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              marginBottom: 24,
              color: "#0f172a",
            }}
          >
            {isLogin ? "Log in" : "Sign up"}
          </div>

          {/* INPUTS */}
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              style={inputStyle}
              onFocus={focusInput}
              onBlur={blurInput}
              required
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              style={inputStyle}
              onFocus={focusInput}
              onBlur={blurInput}
              required
              minLength={8}
            />

            {/* ERROR MESSAGE */}
            {error && (
              <div
                style={{
                  color: "#991b1b",
                  fontSize: 13,
                  backgroundColor: "#fee2e2",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #fecaca",
                }}
              >
                {error}
              </div>
            )}

            {/* SUCCESS MESSAGE */}
            {success && (
              <div
                style={{
                  color: "#15803d",
                  fontSize: 13,
                  backgroundColor: "#dcfce7",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #bbf7d0",
                }}
              >
                ✓ {success}
              </div>
            )}

            {/* BUTTON */}
            <button
              type="submit"
              disabled={loading}
              style={{
                ...loginBtn,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => !loading && hoverLogin(e)}
              onMouseLeave={(e) => !loading && leaveLogin(e)}
              onMouseDown={(e) => !loading && pressLogin(e)}
              onMouseUp={(e) => !loading && releaseLogin(e)}
            >
              {loading ? "Loading..." : isLogin ? "Log in" : "Sign up"}
            </button>
          </form>

          {/* FOOTER */}
          <div
            style={{
              marginTop: 18,
              fontSize: 13,
              color: "#64748b",
            }}
          >
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <span
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
                setEmail("");
                setPassword("");
                setSuccess("");
              }}
              style={{
                color: "#4f46e5",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all .18s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#4338ca";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#4f46e5";
              }}
            >
              {isLogin ? "Sign up" : "Log in"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
