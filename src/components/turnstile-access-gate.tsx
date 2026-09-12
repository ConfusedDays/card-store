"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { ShieldCheck } from "lucide-react";
import { TurnstileWidget } from "@/components/turnstile-widget";

const ACCESS_SESSION_KEY = "reiishop.turnstile-access.session";

export function TurnstileAccessGate({ siteKey, children }: { siteKey?: string; children: React.ReactNode }) {
  const hasStoredAccess = useSyncExternalStore(
    () => () => undefined,
    () => window.sessionStorage.getItem(ACCESS_SESSION_KEY) === "true",
    () => false,
  );
  const [verified, setVerified] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const open = Boolean(siteKey && !verified && !hasStoredAccess);
    document.body.classList.toggle("access-gate-open", open);
    return () => document.body.classList.remove("access-gate-open");
  }, [hasStoredAccess, siteKey, verified]);

  const verifyAccess = useCallback(async (nextToken: string) => {
    setToken(nextToken);
    setError("");
    if (!nextToken) return;
    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: nextToken }),
      });
      const data = await response.json() as { verified?: boolean; error?: string };
      if (!response.ok || !data.verified) throw new Error(data.error ?? "验证失败，请重试");
      window.sessionStorage.setItem(ACCESS_SESSION_KEY, "true");
      setVerified(true);
    } catch (reason) {
      setToken("");
      setError(reason instanceof Error ? reason.message : "验证失败，请重试");
    }
  }, []);

  if (!siteKey || verified || hasStoredAccess) return <>{children}</>;

  return (
    <main className="access-gate-shell" aria-live="polite">
      <section className="access-gate-card" aria-labelledby="access-gate-title">
        <span className="access-gate-icon" aria-hidden="true"><ShieldCheck size={25} /></span>
        <span className="access-gate-kicker">REII SHOP · SECURITY CHECK</span>
        <h1 id="access-gate-title">进入网站前，请完成安全验证</h1>
        <p>验证通过后即可访问商品、订单和账户页面。</p>
        <TurnstileWidget action="site_access" siteKey={siteKey} onVerify={verifyAccess} />
        {token && !error && <span className="access-gate-success">验证通过，正在进入网站…</span>}
        {error && <span className="access-gate-error" role="alert">{error}</span>}
      </section>
    </main>
  );
}
