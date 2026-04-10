/**
 * client/src/Root.jsx
 *
 * Root app wrapper that handles authentication.
 */

import { useEffect, useState } from "react";
import App from "./App";
import AuthScreen from "./components/AuthScreen";
import { getMe, logout } from "./services/auth";

export default function Root() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on load
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const currentUser = await getMe();
      if (currentUser) {
        setUser(currentUser);
      }
    } catch (err) {
      console.error("[checkAuth]", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          fontSize: "1.5rem",
          color: "#666",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        onSuccess={() => {
          // Small delay to ensure session cookie is set
          setTimeout(() => checkAuth(), 100);
        }}
      />
    );
  }

  return (
    <App
      user={user}
      onLogout={async () => {
        try {
          await logout();
          setUser(null);
        } catch (err) {
          console.error("[logout]", err);
        }
      }}
    />
  );
}
