import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { env } from "../../env.js";

type CardRow = {
  projectId: string;
  title: string;
  shortDescription: string;
  signupCount: number;
  participantNames: string[];
  isSignedUp: boolean;
};

const dbPath = resolve(process.cwd(), env.debugSqlitePath);
mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  create table if not exists participants (
    id text primary key,
    display_name text not null,
    client_id text not null unique,
    created_at text not null default (datetime('now'))
  );

  create table if not exists projects (
    id text primary key,
    title text not null,
    short_description text not null,
    status text not null default 'pending',
    created_at text not null default (datetime('now'))
  );

  create table if not exists signups (
    participant_id text primary key,
    project_id text not null,
    created_at text not null default (datetime('now'))
  );

  create index if not exists signups_project_id_idx on signups (project_id);
`);

export const sqlitePrimary = {
  findParticipantByClientId(clientId: string): { id: string } | null {
    return (
      (db
        .prepare(
          `
            select id
            from participants
            where client_id = ?
            limit 1
          `,
        )
        .get(clientId) as { id: string } | undefined) ?? null
    );
  },

  bootstrapParticipant(input: { id: string; displayName: string; clientId: string }) {
    db.prepare(
      `
        insert into participants (id, display_name, client_id, created_at)
        values (@id, @displayName, @clientId, datetime('now'))
        on conflict(client_id) do update set
          display_name = excluded.display_name
      `,
    ).run(input);

    return db
      .prepare(
        `
          select id, display_name as displayName, client_id as clientId
          from participants
          where client_id = ?
          limit 1
        `,
      )
      .get(input.clientId) as { id: string; displayName: string; clientId: string };
  },

  getProjectStatus(projectId: string): { status: string } | null {
    return (
      (db
        .prepare(
          `
            select status
            from projects
            where id = ?
            limit 1
          `,
        )
        .get(projectId) as { status: string } | undefined) ?? null
    );
  },

  listApprovedProjectCards(input: { limit: number; offset: number; clientId: string | null }): CardRow[] {
    const rows = db
      .prepare(
        `
          select
            p.id as projectId,
            p.title as title,
            p.short_description as shortDescription,
            count(s.participant_id) as signupCount,
            exists (
              select 1
              from signups s2
              join participants p2 on p2.id = s2.participant_id
              where s2.project_id = p.id
                and p2.client_id = @clientId
            ) as isSignedUp
          from projects p
          left join signups s on s.project_id = p.id
          where p.status = 'approved'
          group by p.id
          order by p.created_at desc
          limit @limit
          offset @offset
        `,
      )
      .all({
        clientId: input.clientId,
        limit: input.limit + 1,
        offset: input.offset,
      }) as Array<{
      projectId: string;
      title: string;
      shortDescription: string;
      signupCount: number;
      isSignedUp: number;
    }>;

    return rows.map((row) => {
      const participantNames = db
        .prepare(
          `
            select p.display_name as displayName
            from signups s
            join participants p on p.id = s.participant_id
            where s.project_id = ?
            order by s.created_at asc
          `,
        )
        .all(row.projectId) as Array<{ displayName: string }>;

      return {
        projectId: row.projectId,
        title: row.title,
        shortDescription: row.shortDescription,
        signupCount: Number(row.signupCount),
        participantNames: participantNames.map((entry) => entry.displayName),
        isSignedUp: Boolean(row.isSignedUp),
      };
    });
  },

  getApprovedProject(projectId: string): { id: string; title: string; shortDescription: string } | null {
    return (
      (db
        .prepare(
          `
            select id, title, short_description as shortDescription
            from projects
            where id = ?
              and status = 'approved'
            limit 1
          `,
        )
        .get(projectId) as { id: string; title: string; shortDescription: string } | undefined) ?? null
    );
  },

  getProjectParticipants(projectId: string): Array<{ displayName: string }> {
    return db
      .prepare(
        `
          select p.display_name as displayName
          from signups s
          join participants p on p.id = s.participant_id
          where s.project_id = ?
          order by s.created_at asc
        `,
      )
      .all(projectId) as Array<{ displayName: string }>;
  },

  upsertSignup(input: { participantId: string; projectId: string }) {
    db.prepare(
      `
        insert into signups (participant_id, project_id, created_at)
        values (@participantId, @projectId, datetime('now'))
        on conflict(participant_id) do update set
          project_id = excluded.project_id,
          created_at = excluded.created_at
      `,
    ).run(input);

    return {
      participant_id: input.participantId,
      project_id: input.projectId,
    };
  },

  getCurrentSignup(participantId: string): { project_id: string } | null {
    return (
      (db
        .prepare(
          `
            select project_id
            from signups
            where participant_id = ?
            limit 1
          `,
        )
        .get(participantId) as { project_id: string } | undefined) ?? null
    );
  },

  switchSignup(input: { participantId: string; projectId: string }) {
    const tx = db.transaction(() => {
      db.prepare("delete from signups where participant_id = ?").run(input.participantId);
      db.prepare(
        `
          insert into signups (participant_id, project_id, created_at)
          values (?, ?, datetime('now'))
        `,
      ).run(input.participantId, input.projectId);
      return {
        participant_id: input.participantId,
        project_id: input.projectId,
      };
    });

    return tx();
  },

  deleteSignup(participantId: string): { participant_id: string } | null {
    const result = db
      .prepare(
        `
          delete from signups
          where participant_id = ?
          returning participant_id
        `,
      )
      .get(participantId) as { participant_id: string } | undefined;

    return result ?? null;
  },

  createPendingProject(input: {
    id: string;
    title: string;
    shortDescription: string;
    status: "pending";
  }) {
    db.prepare(
      `
        insert into projects (id, title, short_description, status, created_at)
        values (@id, @title, @shortDescription, @status, datetime('now'))
      `,
    ).run(input);

    return {
      id: input.id,
      title: input.title,
      short_description: input.shortDescription,
      status: input.status,
    };
  },

  updateProjectStatus(input: { projectId: string; status: "pending" | "approved" | "rejected" }) {
    const row = db
      .prepare(
        `
          update projects
          set status = @status
          where id = @projectId
          returning id, title, short_description, status
        `,
      )
      .get(input) as
      | { id: string; title: string; short_description: string; status: "pending" | "approved" | "rejected" }
      | undefined;

    return row ?? null;
  },
};
