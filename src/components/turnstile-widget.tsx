"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { ShieldCheck } from "lucide-react";

type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    theme: "dark";
    size: "flexible";
    action: string;
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
  }) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileWidget({ siteKey, action = "create_order", onVerify }: { siteKey: string; action?: string; onVerify: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [message, setMessage] = useState("正在进行安全验证…");

  const renderWidget = useCallback(() => {
    if (widgetIdRef.current) return true;
    if (!containerRef.current || !window.turnstile) return false;

    try {
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "dark",
        size: "flexible",
        action,
        callback: (token) => {
          setMessage("人机验证已通过");
          onVerify(token);
        },
        "expired-callback": () => {
          setMessage("验证已过期，请重新验证");
          onVerify("");
        },
        "error-callback": () => {
          setMessage("验证加载失败，请刷新后重试");
          onVerify("");
        },
      });
      return true;
    } catch {
      return false;
    }
  }, [action, onVerify, siteKey]);

  useEffect(() => {
    renderWidget();

    const retryTimer = window.setInterval(() => {
      if (renderWidget()) window.clearInterval(retryTimer);
    }, 100);
    const timeout = window.setTimeout(() => {
      window.clearInterval(retryTimer);
      if (!widgetIdRef.current) setMessage("验证加载失败，请刷新后重试");
    }, 10000);

    return () => {
      window.clearInterval(retryTimer);
      window.clearTimeout(timeout);
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
      onVerify("");
    };
  }, [onVerify, renderWidget]);

  return (
    <div className="turnstile-field">
      <Script
        id={`cloudflare-turnstile-${action}`}
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => { renderWidget(); }}
        onReady={() => { renderWidget(); }}
        onError={() => setMessage("验证加载失败，请刷新后重试")}
      />
      <div ref={containerRef} className="turnstile-container" />
      <span className="turnstile-status"><ShieldCheck size={14} /> {message}</span>
    </div>
  );
}
