/**
 * client/src/components/AuthScreen.jsx
 *
 * Login and register screen.
 */

import { useState } from "react";
import { login, register } from "../services/auth";

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
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "2rem",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          width: "100%",
          maxWidth: "400px",
        }}
      >
        <h1 style={{ margin: "0 0 1.5rem", fontSize: "1.5rem", color: "#333" }}>
          {isLogin ? "Log in" : "Sign up"}
        </h1>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: "0.75rem",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "1rem",
              fontFamily: "inherit",
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            style={{
              padding: "0.75rem",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "1rem",
              fontFamily: "inherit",
            }}
          />

          {error && (
            <div
              style={{
                color: "#d32f2f",
                fontSize: "0.875rem",
                backgroundColor: "#ffebee",
                padding: "0.75rem",
                borderRadius: "4px",
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                color: "#1b5e20",
                fontSize: "0.875rem",
                backgroundColor: "#e8f5e9",
                padding: "0.75rem",
                borderRadius: "4px",
              }}
            >
              ✓ {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "0.75rem",
              backgroundColor: "#1976d2",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              fontFamily: "inherit",
            }}
          >
            {loading ? "Loading..." : isLogin ? "Log in" : "Sign up"}
          </button>
        </form>

        <p
          style={{
            margin: "1.5rem 0 0",
            textAlign: "center",
            fontSize: "0.875rem",
            color: "#666",
          }}
        >
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
              setEmail("");
              setPassword("");
            }}
            style={{
              background: "none",
              border: "none",
              color: "#1976d2",
              cursor: "pointer",
              fontSize: "inherit",
              fontWeight: "bold",
              textDecoration: "underline",
              fontFamily: "inherit",
              padding: 0,
            }}
          >
            {isLogin ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}
