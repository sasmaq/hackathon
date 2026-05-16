export type ProjectStatus = "approved" | "pending" | "rejected";

export type Identity = {
  clientId: string;
  displayName: string;
};

export type Project = {
  id: string;
  title: string;
  shortDescription: string;
  status: ProjectStatus;
  createdAt: string;
};

export type Signup = {
  clientId: string;
  displayName: string;
  projectId: string;
  joinedAt: string;
};

export type ProjectCard = Project & {
  signupCount: number;
  participantNamesPreview: string[];
  remainingParticipantCount: number;
  isSignedUp: boolean;
};

export type ProjectDetails = ProjectCard & {
  participantNames: string[];
};
