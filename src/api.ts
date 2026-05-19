import type { ProjectCard, ProjectDetails } from "./types";

const configuredApiBase = globalThis.__APP_API_BASE_URL?.trim();
const fallbackOrigin =
  typeof window !== "undefined" && window.location.origin.startsWith("http")
    ? window.location.origin
    : "http://localhost";
const API_BASE_URL = configuredApiBase && configuredApiBase.length > 0 ? configuredApiBase : fallbackOrigin;

type ProjectCardsResponse = {
  items: Array<{
    projectId: string;
    title: string;
    shortDescription: string;
    signupCount: number;
    participantNamesPreview: string[];
    isSignedUp: boolean;
  }>;
  limit: number;
  offset: number;
  hasMore: boolean;
};

type ProjectDetailsResponse = {
  projectId: string;
  title: string;
  shortDescription: string;
  participants: string[];
};

type ParticipantBootstrapResponse = {
  participantId: string;
  displayName: string;
  clientId: string;
};

type SignupMutationResponse = {
  participantId: string;
  projectId: string;
};

type DeleteSignupResponse = {
  participantId: string;
  deleted: boolean;
};

type ProposeProjectResponse = {
  projectId: string;
  title: string;
  shortDescription: string;
  status: "pending" | "approved" | "rejected";
};

async function fetchJson<T>(
  path: string,
  clientId: string,
  init?: { method?: "GET" | "POST" | "DELETE"; body?: Record<string, unknown> },
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "X-Client-Id": clientId,
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorBody?.error ?? "Request failed");
  }

  return (await response.json()) as T;
}

export async function getProjectCards(
  clientId: string,
  limit: number,
  offset: number,
): Promise<{ items: ProjectCard[]; hasMore: boolean }> {
  const response = await fetchJson<ProjectCardsResponse>(
    `/api/projects/cards?limit=${limit}&offset=${offset}`,
    clientId,
  );

  return {
    items: response.items.map((item) => ({
      id: item.projectId,
      title: item.title,
      shortDescription: item.shortDescription,
      status: "approved",
      createdAt: "",
      signupCount: item.signupCount,
      participantNamesPreview: item.participantNamesPreview,
      remainingParticipantCount: Math.max(item.signupCount - item.participantNamesPreview.length, 0),
      isSignedUp: item.isSignedUp,
    })),
    hasMore: response.hasMore,
  };
}

export async function getProjectDetails(
  clientId: string,
  projectId: string,
): Promise<ProjectDetails> {
  const response = await fetchJson<ProjectDetailsResponse>(`/api/projects/${projectId}`, clientId);

  return {
    id: response.projectId,
    title: response.title,
    shortDescription: response.shortDescription,
    status: "approved",
    createdAt: "",
    signupCount: response.participants.length,
    participantNamesPreview: response.participants.slice(0, 5),
    remainingParticipantCount: Math.max(response.participants.length - 5, 0),
    isSignedUp: false,
    participantNames: response.participants,
  };
}

export async function bootstrapParticipant(
  clientId: string,
  displayName: string,
): Promise<ParticipantBootstrapResponse> {
  return fetchJson<ParticipantBootstrapResponse>("/api/participants/bootstrap", clientId, {
    method: "POST",
    body: { displayName },
  });
}

export async function joinProjectSignup(
  clientId: string,
  projectId: string,
): Promise<SignupMutationResponse> {
  return fetchJson<SignupMutationResponse>("/api/signups/join", clientId, {
    method: "POST",
    body: { projectId },
  });
}

export async function switchProjectSignup(
  clientId: string,
  projectId: string,
): Promise<SignupMutationResponse> {
  return fetchJson<SignupMutationResponse>("/api/signups/switch", clientId, {
    method: "POST",
    body: { projectId },
  });
}

export async function giveUpProjectSignup(clientId: string): Promise<DeleteSignupResponse> {
  return fetchJson<DeleteSignupResponse>("/api/signups", clientId, {
    method: "DELETE",
  });
}

export async function proposeProjectIdea(
  clientId: string,
  title: string,
  shortDescription: string,
): Promise<ProposeProjectResponse> {
  return fetchJson<ProposeProjectResponse>("/api/projects", clientId, {
    method: "POST",
    body: { title, shortDescription },
  });
}
