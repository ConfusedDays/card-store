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

export function TurnstileWidget({ siteKey, onVerify }: { siteKey: string; onVerify: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [message, setMessage] = useState("正在进行安全验证…");

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: "dark",
      size: "flexible",
      action: "create_order",
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
  }, [onVerify, siteKey]);

  useEffect(() => {
    renderWidget();
    return () => {
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
      onVerify("");
    };
  }, [onVerify, renderWidget]);

  return (
    <div className="turnstile-field">
      <Script
        id="cloudflare-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={renderWidget}
      />
      <div ref={containerRef} className="turnstile-container" />
      <span className="turnstile-status"><ShieldCheck size={14} /> {message}</span>
    </div>
  );
}
