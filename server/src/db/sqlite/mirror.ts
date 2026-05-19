import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { env } from "../../env.js";

type MirrorParticipant = {
  id: string;
  displayName: string;
  clientId: string;
  createdAt?: string;
};

type MirrorProject = {
  id: string;
  title: string;
  shortDescription: string;
  status: "pending" | "approved" | "rejected";
  createdAt?: string;
};

type MirrorSignup = {
  participantId: string;
  projectId: string;
  createdAt?: string;
};

class SqliteMirror {
  public enabled: boolean;
  public path: string;
  private db: Database.Database | null;

  constructor() {
    this.enabled = env.debugSqliteMirror;
    this.path = resolve(process.cwd(), env.debugSqlitePath);
    this.db = null;

    if (!this.enabled) {
      return;
    }

    mkdirSync(dirname(this.path), { recursive: true });
    this.db = new Database(this.path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.initializeSchema();
  }

  private initializeSchema() {
    if (!this.db) {
      return;
    }

    this.db.exec(`
      create table if not exists participants (
        id text primary key,
        display_name text not null,
        client_id text not null unique,
        created_at text not null,
        mirrored_at text not null default (datetime('now'))
      );

      create table if not exists projects (
        id text primary key,
        title text not null,
        short_description text not null,
        status text not null,
        created_at text not null,
        mirrored_at text not null default (datetime('now'))
      );

      create table if not exists signups (
        participant_id text primary key,
        project_id text not null,
        created_at text not null,
        mirrored_at text not null default (datetime('now'))
      );

      create table if not exists events (
        id integer primary key autoincrement,
        event_type text not null,
        payload text not null,
        created_at text not null default (datetime('now'))
      );
    `);
  }

  upsertParticipant(input: MirrorParticipant) {
    if (!this.db) {
      return;
    }

    this.db
      .prepare(
        `
          insert into participants (id, display_name, client_id, created_at, mirrored_at)
          values (@id, @displayName, @clientId, @createdAt, datetime('now'))
          on conflict(id) do update set
            display_name = excluded.display_name,
            client_id = excluded.client_id,
            mirrored_at = datetime('now')
        `,
      )
      .run({
        id: input.id,
        displayName: input.displayName,
        clientId: input.clientId,
        createdAt: input.createdAt ?? new Date().toISOString(),
      });
  }

  upsertProject(input: MirrorProject) {
    if (!this.db) {
      return;
    }

    this.db
      .prepare(
        `
          insert into projects (id, title, short_description, status, created_at, mirrored_at)
          values (@id, @title, @shortDescription, @status, @createdAt, datetime('now'))
          on conflict(id) do update set
            title = excluded.title,
            short_description = excluded.short_description,
            status = excluded.status,
            mirrored_at = datetime('now')
        `,
      )
      .run({
        id: input.id,
        title: input.title,
        shortDescription: input.shortDescription,
        status: input.status,
        createdAt: input.createdAt ?? new Date().toISOString(),
      });
  }

  upsertSignup(input: MirrorSignup) {
    if (!this.db) {
      return;
    }

    this.db
      .prepare(
        `
          insert into signups (participant_id, project_id, created_at, mirrored_at)
          values (@participantId, @projectId, @createdAt, datetime('now'))
          on conflict(participant_id) do update set
            project_id = excluded.project_id,
            created_at = excluded.created_at,
            mirrored_at = datetime('now')
        `,
      )
      .run({
        participantId: input.participantId,
        projectId: input.projectId,
        createdAt: input.createdAt ?? new Date().toISOString(),
      });
  }

  deleteSignup(participantId: string) {
    if (!this.db) {
      return;
    }

    this.db.prepare("delete from signups where participant_id = ?").run(participantId);
  }

  appendEvent(eventType: string, payload: Record<string, unknown>) {
    if (!this.db) {
      return;
    }

    this.db
      .prepare(
        `
          insert into events (event_type, payload)
          values (?, ?)
        `,
      )
      .run(eventType, JSON.stringify(payload));
  }
}

export const mirror = new SqliteMirror();

export const mirrorSafe = (action: string, operation: () => void) => {
  if (!mirror.enabled) {
    return;
  }

  try {
    operation();
  } catch (error) {
    console.warn(`[sqlite-mirror] ${action} failed`, error);
  }
};
