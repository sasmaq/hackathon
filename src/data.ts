import type { Identity, Project, ProjectCard, ProjectDetails, Signup } from "./types";

const IDENTITY_KEY = "hackathon.identity";
const PROJECTS_KEY = "hackathon.projects";
const SIGNUPS_KEY = "hackathon.signups";
const CURRENT_PROJECTS_KEY = "hackathon.currentProjects";

const seedProjects: Project[] = [
  {
    id: "ai-review-bot",
    title: "AI Pull Request Review Bot",
    shortDescription:
      "Build an assistant that summarizes code changes and flags risky diffs before review.",
    status: "approved",
    createdAt: "2026-05-16T07:00:00.000Z",
  },
  {
    id: "meeting-to-issues",
    title: "Meeting Notes to GitHub Issues",
    shortDescription:
      "Turn transcript snippets into scoped engineering issues with owners and acceptance criteria.",
    status: "approved",
    createdAt: "2026-05-16T06:45:00.000Z",
  },
  {
    id: "test-case-generator",
    title: "Edge Case Test Generator",
    shortDescription:
      "Analyze functions and propose high-signal unit tests for branches people usually miss.",
    status: "approved",
    createdAt: "2026-05-16T06:30:00.000Z",
  },
  {
    id: "docs-chat",
    title: "Internal Docs Chat",
    shortDescription:
      "Prototype a retrieval assistant that answers questions from a small documentation corpus.",
    status: "approved",
    createdAt: "2026-05-16T06:15:00.000Z",
  },
  {
    id: "bug-repro-agent",
    title: "Bug Reproduction Agent",
    shortDescription:
      "Create a tool that turns a bug report into a minimal repro script and debugging checklist.",
    status: "approved",
    createdAt: "2026-05-16T06:00:00.000Z",
  },
  {
    id: "design-to-ui",
    title: "Design Prompt to UI",
    shortDescription:
      "Generate accessible React component drafts from plain-language product requirements.",
    status: "approved",
    createdAt: "2026-05-16T05:45:00.000Z",
  },
  {
    id: "sql-explainer",
    title: "SQL Query Explainer",
    shortDescription:
      "Explain complex SQL, highlight performance risks, and suggest safer alternatives.",
    status: "approved",
    createdAt: "2026-05-16T05:30:00.000Z",
  },
  {
    id: "incident-timeline",
    title: "Incident Timeline Builder",
    shortDescription:
      "Transform logs and notes into a clear timeline with suspected causes and next actions.",
    status: "approved",
    createdAt: "2026-05-16T05:15:00.000Z",
  },
  {
    id: "accessibility-copilot",
    title: "Accessibility Copilot",
    shortDescription:
      "Scan UI snippets and recommend practical fixes for keyboard, contrast, and screen reader gaps.",
    status: "approved",
    createdAt: "2026-05-16T05:00:00.000Z",
  },
  {
    id: "prompt-regression-suite",
    title: "Prompt Regression Suite",
    shortDescription:
      "Compare prompt versions against saved examples and show where model behavior changed.",
    status: "approved",
    createdAt: "2026-05-16T04:45:00.000Z",
  },
];

export function loadIdentity(): Identity | null {
  return readJson<Identity | null>(IDENTITY_KEY, null);
}

export function saveIdentity(displayName: string): Identity {
  const identity = {
    clientId: crypto.randomUUID(),
    displayName: displayName.trim(),
  };

  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

export function updateDisplayName(identity: Identity, displayName: string): Identity {
  const updatedIdentity = { ...identity, displayName: displayName.trim() };
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(updatedIdentity));

  const signups = loadSignups().map((signup) =>
    signup.clientId === identity.clientId
      ? { ...signup, displayName: updatedIdentity.displayName }
      : signup,
  );
  persistSignups(signups);

  return updatedIdentity;
}

export function loadProjectCards(identity: Identity): ProjectCard[] {
  const signups = loadSignups();

  return loadProjects()
    .filter((project) => project.status === "approved")
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .map((project) => buildProjectCard(project, signups, identity.clientId));
}

export function loadProjectDetails(projectId: string, identity: Identity): ProjectDetails | null {
  const project = loadProjects().find(
    (candidate) => candidate.id === projectId && candidate.status === "approved",
  );

  if (!project) {
    return null;
  }

  const signups = loadSignups();
  const card = buildProjectCard(project, signups, identity.clientId);
  const participantNames = signups
    .filter((signup) => signup.projectId === project.id)
    .sort((left, right) => Date.parse(left.joinedAt) - Date.parse(right.joinedAt))
    .map((signup) => signup.displayName);

  return { ...card, participantNames };
}

export function loadCurrentProjectId(identity: Identity): string | null {
  return loadSignups().find((signup) => signup.clientId === identity.clientId)?.projectId ?? null;
}

export function loadPersistedCurrentProjectId(clientId: string): string | null {
  const persisted = readJson<Record<string, string>>(CURRENT_PROJECTS_KEY, {});
  return persisted[clientId] ?? null;
}

export function persistCurrentProjectId(clientId: string, projectId: string): void {
  const persisted = readJson<Record<string, string>>(CURRENT_PROJECTS_KEY, {});
  localStorage.setItem(
    CURRENT_PROJECTS_KEY,
    JSON.stringify({
      ...persisted,
      [clientId]: projectId,
    }),
  );
}

export function clearPersistedCurrentProjectId(clientId: string): void {
  const persisted = readJson<Record<string, string>>(CURRENT_PROJECTS_KEY, {});

  if (!(clientId in persisted)) {
    return;
  }

  const next = { ...persisted };
  delete next[clientId];
  localStorage.setItem(CURRENT_PROJECTS_KEY, JSON.stringify(next));
}

export function joinProject(identity: Identity, projectId: string): void {
  const existingSignups = loadSignups().filter((signup) => signup.clientId !== identity.clientId);

  persistSignups([
    ...existingSignups,
    {
      clientId: identity.clientId,
      displayName: identity.displayName,
      projectId,
      joinedAt: new Date().toISOString(),
    },
  ]);
}

export function giveUpProject(identity: Identity): void {
  persistSignups(loadSignups().filter((signup) => signup.clientId !== identity.clientId));
}

export function proposeProject(title: string, shortDescription: string): Project {
  const project: Project = {
    id: crypto.randomUUID(),
    title: title.trim(),
    shortDescription: shortDescription.trim(),
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(PROJECTS_KEY, JSON.stringify([project, ...loadProjects()]));
  return project;
}

function buildProjectCard(project: Project, signups: Signup[], clientId: string): ProjectCard {
  const projectSignups = signups.filter((signup) => signup.projectId === project.id);
  const participantNames = projectSignups
    .sort((left, right) => Date.parse(left.joinedAt) - Date.parse(right.joinedAt))
    .map((signup) => signup.displayName);
  const participantNamesPreview = participantNames.slice(0, 5);

  return {
    ...project,
    signupCount: participantNames.length,
    participantNamesPreview,
    remainingParticipantCount: Math.max(
      participantNames.length - participantNamesPreview.length,
      0,
    ),
    isSignedUp: projectSignups.some((signup) => signup.clientId === clientId),
  };
}

function loadProjects(): Project[] {
  const projects = readJson<Project[] | null>(PROJECTS_KEY, null);

  if (projects) {
    return projects;
  }

  localStorage.setItem(PROJECTS_KEY, JSON.stringify(seedProjects));
  return seedProjects;
}

function loadSignups(): Signup[] {
  return readJson<Signup[]>(SIGNUPS_KEY, []);
}

function persistSignups(signups: Signup[]): void {
  localStorage.setItem(SIGNUPS_KEY, JSON.stringify(signups));
}

function readJson<T>(key: string, fallback: T): T {
  const value = localStorage.getItem(key);

  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`Failed to parse ${key}`, error);
    return fallback;
  }
}
