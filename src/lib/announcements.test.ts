import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const testDirectory = mkdtempSync(join(tmpdir(), "card-store-announcements-"));
let database: typeof import("./db").db;
let createAnnouncement: typeof import("./announcements").createAnnouncement;
let getAdminAnnouncements: typeof import("./announcements").getAdminAnnouncements;
let getPublicAnnouncements: typeof import("./announcements").getPublicAnnouncements;
let updateAnnouncement: typeof import("./announcements").updateAnnouncement;
let deleteAnnouncement: typeof import("./announcements").deleteAnnouncement;

beforeAll(async () => {
  vi.stubEnv("DATABASE_PATH", join(testDirectory, "test.sqlite"));
  vi.stubEnv("LICENSE_KEY_SECRET", "test-announcement-secret");
  ({ db: database } = await import("./db"));
  ({ createAnnouncement, getAdminAnnouncements, getPublicAnnouncements, updateAnnouncement, deleteAnnouncement } = await import("./announcements"));
});

afterAll(() => {
  database.close();
  vi.unstubAllEnvs();
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("announcements", () => {
  it("creates, updates, filters, and deletes notices", () => {
    const created = createAnnouncement({ title: "维护通知", content: "今晚 23:00 维护。", level: "important", active: true });
    expect(getPublicAnnouncements()).toHaveLength(1);
    expect(getAdminAnnouncements()[0]).toMatchObject({ id: created.id, title: "维护通知", active: true, level: "important" });

    const updated = updateAnnouncement({ id: created.id, content: "维护已完成。", active: false });
    expect(updated.content).toBe("维护已完成。");
    expect(getPublicAnnouncements()).toHaveLength(0);
    expect(deleteAnnouncement(created.id)).toEqual({ deleted: true });
    expect(getAdminAnnouncements()).toHaveLength(0);
  });
});
