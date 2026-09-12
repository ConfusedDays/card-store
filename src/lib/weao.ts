export type LiveExploitStatus = {
  title: string;
  version: string | null;
  updatedDate: string | null;
  robloxVersion: string | null;
  updateStatus: boolean;
  platform: string | null;
};

export type RobloxVersions = {
  Windows: string | null;
  WindowsHash: string | null;
  WindowsDate: string | null;
  Mac: string | null;
  MacHash: string | null;
  MacDate: string | null;
  Android: string | null;
  AndroidDate: string | null;
  iOS: string | null;
  iOSDate: string | null;
};

export type LiveStatus = {
  exploits: LiveExploitStatus[];
  roblox: RobloxVersions;
  fetchedAt: string;
  source: "WEAO";
  error?: string;
};

type JsonRecord = Record<string, unknown>;

const DEFAULT_API_BASE = "https://weao.xyz/api";
const CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 8_000;

let cached: { value: LiveStatus; expiresAt: number } | null = null;
let pending: Promise<LiveStatus> | null = null;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === "updated" || value === 1;
}

export function normalizeExploitStatuses(payload: unknown): LiveExploitStatus[] {
  const rows = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.exploits)
      ? payload.exploits
      : [];

  return rows.flatMap((value) => {
    if (!isRecord(value)) return [];
    const title = asString(value.title);
    if (!title) return [];
    return [{
      title,
      version: asString(value.version),
      updatedDate: asString(value.updatedDate),
      robloxVersion: asString(value.rbxversion),
      updateStatus: asBoolean(value.updateStatus),
      platform: asString(value.platform),
    }];
  });
}

export function normalizeRobloxVersions(payload: unknown): RobloxVersions {
  const source = isRecord(payload) ? payload : {};
  const windowsResponse = isRecord(source.WindowsResponse) ? source.WindowsResponse : {};
  const macResponse = isRecord(source.MacResponse) ? source.MacResponse : {};
  return {
    Windows: asString(windowsResponse.version) ?? asString(source.Windows),
    WindowsHash: asString(windowsResponse.clientVersionUpload) ?? asString(source.Windows),
    WindowsDate: asString(source.WindowsDate),
    Mac: asString(macResponse.version) ?? asString(source.Mac),
    MacHash: asString(macResponse.clientVersionUpload) ?? asString(source.Mac),
    MacDate: asString(source.MacDate),
    Android: asString(source.Android),
    AndroidDate: asString(source.AndroidDate),
    iOS: asString(source.iOS),
    iOSDate: asString(source.iOSDate),
  };
}

async function fetchJson(base: string, path: string): Promise<unknown> {
  const response = await fetch(`${base}${path}`, {
    headers: { accept: "application/json", "user-agent": "WEAO-3PService" },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`WEAO ${path} returned ${response.status}`);
  return response.json();
}

function getApiBases() {
  const configured = process.env.WEAO_API_BASE?.trim().replace(/\/$/, "");
  return [...new Set([configured, DEFAULT_API_BASE].filter((value): value is string => Boolean(value)))];
}

function emptyVersions(): RobloxVersions {
  return { Windows: null, WindowsHash: null, WindowsDate: null, Mac: null, MacHash: null, MacDate: null, Android: null, AndroidDate: null, iOS: null, iOSDate: null };
}

async function loadLiveStatus(): Promise<LiveStatus> {
  let lastError = "暂时无法连接状态服务";
  for (const base of getApiBases()) {
    try {
      const [exploits, versions] = await Promise.all([
        fetchJson(base, "/status/exploits"),
        fetchJson(base, "/versions/current"),
      ]);
      return {
        exploits: normalizeExploitStatuses(exploits),
        roblox: normalizeRobloxVersions(versions),
        fetchedAt: new Date().toISOString(),
        source: "WEAO",
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }

  return {
    exploits: [],
    roblox: emptyVersions(),
    fetchedAt: new Date().toISOString(),
    source: "WEAO",
    error: lastError,
  };
}

export async function getLiveStatus(): Promise<LiveStatus> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;
  if (pending) return pending;

  pending = loadLiveStatus()
    .then((value) => {
      if (!value.error || !cached) cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
      return cached?.value ?? value;
    })
    .finally(() => {
      pending = null;
    });

  return pending;
}
