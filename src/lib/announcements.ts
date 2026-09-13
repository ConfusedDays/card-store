import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

export const announcementLevels = ["info", "important"] as const;
export type AnnouncementLevel = (typeof announcementLevels)[number];

export type Announcement = {
  id: string;
  title: string;
  content: string;
  level: AnnouncementLevel;
  active: boolean;
  createdAt: number;
  updatedAt: number;
};

type AnnouncementRow = Omit<Announcement, "active"> & { active: number };

function mapAnnouncement(row: AnnouncementRow): Announcement {
  return { ...row, active: Boolean(row.active) };
}

const announcementSelect = `
  SELECT id, title, content, level, active,
    created_at AS createdAt, updated_at AS updatedAt
  FROM announcements
`;

export function getPublicAnnouncements(limit = 3) {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 20));
  const rows = db.prepare(`${announcementSelect} WHERE active = 1 ORDER BY updated_at DESC LIMIT ?`).all(safeLimit) as AnnouncementRow[];
  return rows.map(mapAnnouncement);
}

export function getAdminAnnouncements() {
  const rows = db.prepare(`${announcementSelect} ORDER BY updated_at DESC LIMIT 200`).all() as AnnouncementRow[];
  return rows.map(mapAnnouncement);
}

export function createAnnouncement(input: { title: string; content: string; level: AnnouncementLevel; active: boolean }) {
  const id = randomUUID();
  const now = Date.now();
  db.prepare(`
    INSERT INTO announcements (id, title, content, level, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.title.trim(), input.content.trim(), input.level, input.active ? 1 : 0, now, now);
  db.prepare("INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)")
    .run("announcement.created", "announcement", id, JSON.stringify({ title: input.title.trim(), level: input.level, active: input.active }));
  return getAdminAnnouncements().find((item) => item.id === id) as Announcement;
}

export function updateAnnouncement(input: { id: string; title?: string; content?: string; level?: AnnouncementLevel; active?: boolean }) {
  const existing = db.prepare("SELECT id, title, content, level, active FROM announcements WHERE id = ?").get(input.id) as { id: string; title: string; content: string; level: AnnouncementLevel; active: number } | undefined;
  if (!existing) throw new Error("公告不存在");
  const next = {
    title: input.title?.trim() ?? existing.title,
    content: input.content?.trim() ?? existing.content,
    level: input.level ?? existing.level,
    active: input.active ?? Boolean(existing.active),
  };
  db.prepare("UPDATE announcements SET title = ?, content = ?, level = ?, active = ?, updated_at = ? WHERE id = ?")
    .run(next.title, next.content, next.level, next.active ? 1 : 0, Date.now(), input.id);
  db.prepare("INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)")
    .run("announcement.updated", "announcement", input.id, JSON.stringify(next));
  return getAdminAnnouncements().find((item) => item.id === input.id) as Announcement;
}

export function deleteAnnouncement(id: string) {
  const result = db.prepare("DELETE FROM announcements WHERE id = ?").run(id);
  if (!result.changes) throw new Error("公告不存在");
  db.prepare("INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)")
    .run("announcement.deleted", "announcement", id, "{}");
  return { deleted: true };
}
