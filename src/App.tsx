import {
  Component,
  FormEvent,
  MouseEvent,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  bootstrapParticipant,
  getProjectCards,
  getProjectDetails,
  giveUpProjectSignup,
  joinProjectSignup,
  proposeProjectIdea,
  switchProjectSignup,
} from "./api";
import {
  clearPersistedCurrentProjectId,
  loadPersistedCurrentProjectId,
  loadIdentity,
  persistCurrentProjectId,
  saveIdentity,
  updateDisplayName,
} from "./data";
import type { Identity, ProjectCard, ProjectDetails } from "./types";

const PAGE_SIZE = 6;
const MAX_PROPOSAL_TITLE_LENGTH = 120;
const MAX_PROPOSAL_SHORT_DESCRIPTION_LENGTH = 500;
const SCRIPT_TAG_REGEX = /<\s*\/?\s*script\b/i;

export default function App() {
  return (
    <BrowserRouter>
      <HackathonApp />
    </BrowserRouter>
  );
}

function HackathonApp() {
  const navigate = useNavigate();
  const [identity, setIdentity] = useState<Identity | null>(() => loadIdentity());
  const [projectCards, setProjectCards] = useState<ProjectCard[]>([]);
  const [hasMoreProjects, setHasMoreProjects] = useState(true);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => {
    const nextIdentity = loadIdentity();
    return nextIdentity ? loadPersistedCurrentProjectId(nextIdentity.clientId) : null;
  });
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [detailsRefreshKey, setDetailsRefreshKey] = useState(0);
  const [proposalMessage, setProposalMessage] = useState<string | null>(null);
  const isProjectsLoadingRef = useRef(false);
  const projectCardsRef = useRef<ProjectCard[]>([]);

  useEffect(() => {
    projectCardsRef.current = projectCards;
  }, [projectCards]);

  const loadProjectsPage = async (nextIdentity: Identity, reset = false) => {
    if (isProjectsLoadingRef.current) {
      return;
    }

    isProjectsLoadingRef.current = true;
    setProjectsError(null);
    setIsProjectsLoading(true);

    try {
      const offset = reset ? 0 : projectCardsRef.current.length;
      const response = await getProjectCards(nextIdentity.clientId, PAGE_SIZE, offset);
      setProjectCards((previous) => {
        if (reset) {
          return response.items;
        }

        const existingIds = new Set(previous.map((project) => project.id));
        const nextItems = response.items.filter((project) => !existingIds.has(project.id));
        return [...previous, ...nextItems];
      });
      setHasMoreProjects(response.hasMore);
      const signedProject = response.items.find((project) => project.isSignedUp);
      if (signedProject) {
        setCurrentProjectId(signedProject.id);
        persistCurrentProjectId(nextIdentity.clientId, signedProject.id);
      }
    } catch (error) {
      console.error(error);
      setProjectsError("Unable to load projects right now.");
    } finally {
      isProjectsLoadingRef.current = false;
      setIsProjectsLoading(false);
    }
  };

  useEffect(() => {
    if (!identity) {
      return;
    }

    let isCancelled = false;

    queueMicrotask(() => {
      void (async () => {
        setProjectsError(null);
        setIsProjectsLoading(true);

        try {
          const response = await getProjectCards(identity.clientId, PAGE_SIZE, 0);

          if (!isCancelled) {
            setProjectCards(response.items);
            setHasMoreProjects(response.hasMore);
          }
        } catch (error) {
          if (!isCancelled) {
            console.error(error);
            setProjectsError("Unable to load projects right now.");
          }
        } finally {
          if (!isCancelled) {
            setIsProjectsLoading(false);
          }
        }
      })();
    });

    return () => {
      isCancelled = true;
    };
  }, [identity]);

  function handleStart(displayName: string) {
    const nextIdentity = saveIdentity(displayName);
    setIdentity(nextIdentity);
    setCurrentProjectId(loadPersistedCurrentProjectId(nextIdentity.clientId));
    void navigate("/");
  }

  function handleRename(displayName: string) {
    if (!identity) {
      return;
    }

    const nextIdentity = updateDisplayName(identity, displayName);
    setIdentity(nextIdentity);
  }

  const applyOptimisticSignup = (nextProjectId: string | null, previousProjectId: string | null) => {
    setProjectCards((previousCards) =>
      previousCards.map((project) => {
        const wasCurrent = project.id === previousProjectId;
        const isCurrent = project.id === nextProjectId;
        let nextSignupCount = project.signupCount;

        if (wasCurrent && !isCurrent && nextSignupCount > 0) {
          nextSignupCount -= 1;
        }

        if (!wasCurrent && isCurrent) {
          nextSignupCount += 1;
        }

        return {
          ...project,
          signupCount: nextSignupCount,
          isSignedUp: isCurrent,
          remainingParticipantCount: Math.max(
            nextSignupCount - project.participantNamesPreview.length,
            0,
          ),
        };
      }),
    );
  };

  const ensureBootstrapped = async (nextIdentity: Identity): Promise<string> => {
    if (participantId) {
      return participantId;
    }

    const response = await bootstrapParticipant(nextIdentity.clientId, nextIdentity.displayName);
    setParticipantId(response.participantId);
    return response.participantId;
  };

  async function refreshProjects(nextIdentity: Identity) {
    await loadProjectsPage(nextIdentity, true);
    setDetailsRefreshKey((value) => value + 1);
  }

  async function handleJoin(projectId: string) {
    if (!identity) {
      return;
    }

    const previousProjectId = currentProjectId;
    const isSwitch = Boolean(previousProjectId && previousProjectId !== projectId);
    setProjectsError(null);
    setCurrentProjectId(projectId);
    persistCurrentProjectId(identity.clientId, projectId);
    applyOptimisticSignup(projectId, previousProjectId);

    try {
      await ensureBootstrapped(identity);

      if (isSwitch) {
        await switchProjectSignup(identity.clientId, projectId);
      } else {
        await joinProjectSignup(identity.clientId, projectId);
      }

      await refreshProjects(identity);
    } catch (error) {
      console.error(error);
      setProjectsError("Unable to update your signup right now.");
      setCurrentProjectId(previousProjectId);
      if (previousProjectId) {
        persistCurrentProjectId(identity.clientId, previousProjectId);
      } else {
        clearPersistedCurrentProjectId(identity.clientId);
      }
      applyOptimisticSignup(previousProjectId, projectId);
    }

    void navigate(`/project/${projectId}`);
  }

  async function handleGiveUp() {
    if (!identity) {
      return;
    }

    if (!currentProjectId) {
      return;
    }

    const previousProjectId = currentProjectId;
    setProjectsError(null);
    setCurrentProjectId(null);
    clearPersistedCurrentProjectId(identity.clientId);
    applyOptimisticSignup(null, previousProjectId);

    try {
      await ensureBootstrapped(identity);
      await giveUpProjectSignup(identity.clientId);
      await refreshProjects(identity);
    } catch (error) {
      console.error(error);
      setProjectsError("Unable to give up this project right now.");
      setCurrentProjectId(previousProjectId);
      if (previousProjectId) {
        persistCurrentProjectId(identity.clientId, previousProjectId);
      }
      applyOptimisticSignup(previousProjectId, null);
    }
  }

  async function handleProposal(title: string, shortDescription: string) {
    if (!identity) {
      return;
    }

    setProposalMessage(null);

    try {
      await ensureBootstrapped(identity);
      await proposeProjectIdea(identity.clientId, title, shortDescription);
      setProposalMessage(
        "Thanks. Your project idea is pending manual review before it appears here.",
      );
      await refreshProjects(identity);
    } catch (error) {
      console.error(error);
      setProposalMessage("Unable to submit your proposal right now. Please try again.");
    }
  }

  if (!identity) {
    return <Onboarding onStart={handleStart} />;
  }

  return (
    <main className="app-shell">
      <Hero identity={identity} onRename={handleRename} />

      <ErrorBoundary>
        <Routes>
          <Route
            path="/"
            element={
              <ProjectBoard
                projects={projectCards}
                totalCount={projectCards.length}
                hasMoreProjects={hasMoreProjects}
                isProjectsLoading={isProjectsLoading}
                projectsError={projectsError}
                currentProjectId={currentProjectId}
                selectedProject={null}
                isDetailsLoading={false}
                detailsError={null}
                hasRequestedProject={false}
                proposalMessage={proposalMessage}
                showProposal={false}
                onSelect={(projectId) => {
                  void navigate(`/project/${projectId}`);
                }}
                onJoin={handleJoin}
                onGiveUp={handleGiveUp}
                onLoadMore={() => void loadProjectsPage(identity)}
                onRetryProjects={() => void loadProjectsPage(identity, true)}
                onRetryDetails={() => {}}
                onProposal={handleProposal}
              />
            }
          />
          <Route
            path="/project/:projectId"
            element={
              <ProjectRoute
                identity={identity}
                projects={projectCards}
                totalCount={projectCards.length}
                hasMoreProjects={hasMoreProjects}
                isProjectsLoading={isProjectsLoading}
                projectsError={projectsError}
                currentProjectId={currentProjectId}
                proposalMessage={proposalMessage}
                detailsRefreshKey={detailsRefreshKey}
                onSelect={(projectId) => {
                  void navigate(`/project/${projectId}`);
                }}
                onJoin={handleJoin}
                onGiveUp={handleGiveUp}
                onLoadMore={() => void loadProjectsPage(identity)}
                onRetryProjects={() => void loadProjectsPage(identity, true)}
                onProposal={handleProposal}
              />
            }
          />
          <Route
            path="/propose"
            element={
              <ProjectBoard
                projects={projectCards}
                totalCount={projectCards.length}
                hasMoreProjects={hasMoreProjects}
                isProjectsLoading={isProjectsLoading}
                projectsError={projectsError}
                currentProjectId={currentProjectId}
                selectedProject={null}
                isDetailsLoading={false}
                detailsError={null}
                hasRequestedProject={false}
                proposalMessage={proposalMessage}
                showProposal
                onSelect={(projectId) => {
                  void navigate(`/project/${projectId}`);
                }}
                onJoin={handleJoin}
                onGiveUp={handleGiveUp}
                onLoadMore={() => void loadProjectsPage(identity)}
                onRetryProjects={() => void loadProjectsPage(identity, true)}
                onRetryDetails={() => {}}
                onProposal={handleProposal}
              />
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ErrorBoundary>
    </main>
  );
}

function ProjectRoute({
  identity,
  projects,
  totalCount,
  hasMoreProjects,
  isProjectsLoading,
  projectsError,
  currentProjectId,
  proposalMessage,
  detailsRefreshKey,
  onSelect,
  onJoin,
  onGiveUp,
  onLoadMore,
  onRetryProjects,
  onProposal,
}: {
  identity: Identity;
  projects: ProjectCard[];
  totalCount: number;
  hasMoreProjects: boolean;
  isProjectsLoading: boolean;
  projectsError: string | null;
  currentProjectId: string | null;
  proposalMessage: string | null;
  detailsRefreshKey: number;
  onSelect: (projectId: string) => void;
  onJoin: (projectId: string) => Promise<void> | void;
  onGiveUp: () => Promise<void> | void;
  onLoadMore: () => void;
  onRetryProjects: () => void;
  onProposal: (title: string, shortDescription: string) => Promise<void> | void;
}) {
  const { projectId } = useParams();
  const [selectedProject, setSelectedProject] = useState<ProjectDetails | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsRetryKey, setDetailsRetryKey] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    const run = async () => {
      if (!projectId) {
        setSelectedProject(null);
        setDetailsError(null);
        setIsDetailsLoading(false);
        return;
      }

      setIsDetailsLoading(true);
      setDetailsError(null);

      try {
        const details = await getProjectDetails(identity.clientId, projectId);
        if (!isCancelled) {
          setSelectedProject(details);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error(error);
          setSelectedProject(null);
          setDetailsError("Unable to load project details right now.");
        }
      } finally {
        if (!isCancelled) {
          setIsDetailsLoading(false);
        }
      }
    };

    queueMicrotask(() => {
      void run();
    });

    return () => {
      isCancelled = true;
    };
  }, [detailsRefreshKey, detailsRetryKey, identity.clientId, projectId]);

  return (
    <ProjectBoard
      projects={projects}
      totalCount={totalCount}
      hasMoreProjects={hasMoreProjects}
      isProjectsLoading={isProjectsLoading}
      projectsError={projectsError}
      currentProjectId={currentProjectId}
      selectedProject={selectedProject}
      isDetailsLoading={isDetailsLoading}
      detailsError={detailsError}
      hasRequestedProject={Boolean(projectId)}
      proposalMessage={proposalMessage}
      showProposal={false}
      onSelect={onSelect}
      onJoin={onJoin}
      onGiveUp={onGiveUp}
      onLoadMore={onLoadMore}
      onRetryProjects={onRetryProjects}
      onRetryDetails={() => setDetailsRetryKey((value) => value + 1)}
      onProposal={onProposal}
    />
  );
}

function ProjectBoard({
  projects,
  totalCount,
  hasMoreProjects,
  isProjectsLoading,
  projectsError,
  currentProjectId,
  selectedProject,
  isDetailsLoading,
  detailsError,
  hasRequestedProject,
  proposalMessage,
  showProposal,
  onSelect,
  onJoin,
  onGiveUp,
  onLoadMore,
  onRetryProjects,
  onRetryDetails,
  onProposal,
}: {
  projects: ProjectCard[];
  totalCount: number;
  hasMoreProjects: boolean;
  isProjectsLoading: boolean;
  projectsError: string | null;
  currentProjectId: string | null;
  selectedProject: ProjectDetails | null;
  isDetailsLoading: boolean;
  detailsError: string | null;
  hasRequestedProject: boolean;
  proposalMessage: string | null;
  showProposal: boolean;
  onSelect: (projectId: string) => void;
  onJoin: (projectId: string) => Promise<void> | void;
  onGiveUp: () => Promise<void> | void;
  onLoadMore: () => void;
  onRetryProjects: () => void;
  onRetryDetails: () => void;
  onProposal: (title: string, shortDescription: string) => Promise<void> | void;
}) {
  return (
    <section className="layout-grid" aria-label="Hackathon projects">
      <div className="project-column">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Project Board</p>
            <h2>Pick one project to work on</h2>
          </div>
          <p className="muted">{totalCount} approved projects</p>
        </div>

        <ProjectList
          projects={projects}
          totalCount={totalCount}
          hasMore={hasMoreProjects}
          isLoading={isProjectsLoading}
          error={projectsError}
          currentProjectId={currentProjectId}
          onSelect={onSelect}
          onJoin={onJoin}
          onGiveUp={onGiveUp}
          onLoadMore={onLoadMore}
          onRetry={onRetryProjects}
        />
      </div>

      <aside className="side-panel" aria-label="Project details and proposals">
        {showProposal ? (
          <ProposalForm onSubmit={onProposal} message={proposalMessage} />
        ) : (
          <>
            <ProjectDetailsPanel
              isLoading={isDetailsLoading}
              error={detailsError}
              hasRequestedProject={hasRequestedProject}
              project={selectedProject}
              currentProjectId={currentProjectId}
              onJoin={onJoin}
              onGiveUp={onGiveUp}
              onRetry={onRetryDetails}
            />
            <Link className="panel-link" to="/propose">
              Propose a new project
            </Link>
          </>
        )}
      </aside>
    </section>
  );
}

function NotFoundPage() {
  return (
    <section className="panel empty-panel">
      <p className="eyebrow">Not Found</p>
      <h2>That page does not exist</h2>
      <p>Return to the project board to keep browsing available hackathon ideas.</p>
      <Link className="panel-link" to="/">
        Back to project board
      </Link>
    </section>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="panel empty-panel" role="alert">
          <p className="eyebrow">Something went wrong</p>
          <h2>Unable to render this view</h2>
          <p>Return to the project board and try again.</p>
          <Link className="panel-link" to="/">
            Back to project board
          </Link>
        </section>
      );
    }

    return this.props.children;
  }
}

function Onboarding({ onStart }: { onStart: (displayName: string) => void }) {
  const [displayName, setDisplayName] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = displayName.trim();

    if (trimmedName) {
      onStart(trimmedName);
    }
  }

  return (
    <main className="onboarding">
      <form className="onboarding-card" onSubmit={handleSubmit}>
        <p className="eyebrow">AI Coding Hackathon</p>
        <h1>What should other participants call you?</h1>
        <p>Enter a display name to browse projects, join one team, and propose new ideas.</p>
        <label htmlFor="display-name">Display name</label>
        <input
          id="display-name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Ada Lovelace"
          autoComplete="name"
          autoFocus
          required
        />
        <button type="submit">Start browsing</button>
      </form>
    </main>
  );
}

function Hero({
  identity,
  onRename,
}: {
  identity: Identity;
  onRename: (displayName: string) => void;
}) {
  const [name, setName] = useState(identity.displayName);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();

    if (trimmedName && trimmedName !== identity.displayName) {
      onRename(trimmedName);
    }
  }

  return (
    <header className="hero">
      <div>
        <p className="eyebrow">AI Coding Hackathon</p>
        <h1>Find a project, join a crew, ship something useful.</h1>
        <p>
          Browse approved ideas, see who has joined, and switch projects whenever your plan changes.
        </p>
      </div>
      <form className="identity-card" onSubmit={handleSubmit}>
        <label htmlFor="rename">Your display name</label>
        <div>
          <input
            id="rename"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <button type="submit">Update</button>
        </div>
      </form>
    </header>
  );
}

function ProjectList({
  projects,
  totalCount,
  hasMore,
  isLoading,
  error,
  currentProjectId,
  onSelect,
  onJoin,
  onGiveUp,
  onLoadMore,
  onRetry,
}: {
  projects: ProjectCard[];
  totalCount: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
  currentProjectId: string | null;
  onSelect: (projectId: string) => void;
  onJoin: (projectId: string) => Promise<void> | void;
  onGiveUp: () => Promise<void> | void;
  onLoadMore: () => void;
  onRetry: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isInitialLoading = isLoading && projects.length === 0;
  const isLoadingMore = isLoading && projects.length > 0;

  useEffect(() => {
    if (!hasMore || !sentinelRef.current || isLoading || projects.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void onLoadMore();
        }
      },
      { rootMargin: "240px" },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore, projects.length]);

  return (
    <>
      {isInitialLoading ? (
        <div className="cards-grid loading-grid" aria-label="Loading projects">
          {Array.from({ length: PAGE_SIZE }).map((_, index) => (
            <article className="project-card skeleton-card" key={`skeleton-${index}`} aria-hidden="true">
              <div className="skeleton-line skeleton-short" />
              <div className="skeleton-line skeleton-title" />
              <div className="skeleton-line skeleton-body" />
              <div className="skeleton-line skeleton-body" />
              <div className="skeleton-chip-row">
                <span />
                <span />
                <span />
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {!isLoading && totalCount === 0 ? (
        <section className="panel empty-panel">
          <p className="eyebrow">Project Board</p>
          <h3>No approved projects yet</h3>
          <p>
            New project proposals stay hidden until manual review. Check back after a project is
            approved.
          </p>
        </section>
      ) : null}
      {error ? (
        <section className="panel empty-panel" role="alert">
          <p className="eyebrow">Project Board</p>
          <h3>Unable to load projects</h3>
          <p>{error}</p>
          <button type="button" className="secondary" onClick={onRetry}>
            Retry loading projects
          </button>
        </section>
      ) : null}
      <div className="cards-grid">
        {projects.length > 0 &&
          projects.map((project) => (
          <ProjectCardView
            key={project.id}
            project={project}
            currentProjectId={currentProjectId}
            onSelect={onSelect}
            onJoin={onJoin}
            onGiveUp={onGiveUp}
          />
          ))}
      </div>

      <div className="load-more" ref={sentinelRef}>
        {isLoadingMore ? <span>Loading more projects...</span> : null}
        {hasMore ? (
          <button type="button" onClick={onLoadMore} disabled={isLoading}>
            Load more projects
          </button>
        ) : !isLoadingMore ? (
          <span>All approved projects are visible.</span>
        ) : null}
      </div>
    </>
  );
}

function ProjectCardView({
  project,
  currentProjectId,
  onSelect,
  onJoin,
  onGiveUp,
}: {
  project: ProjectCard;
  currentProjectId: string | null;
  onSelect: (projectId: string) => void;
  onJoin: (projectId: string) => Promise<void> | void;
  onGiveUp: () => Promise<void> | void;
}) {
  const isCurrent = project.id === currentProjectId;
  const ctaLabel = isCurrent ? "Give up" : currentProjectId ? "Switch here" : "Join project";

  function handleCta(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();

    if (isCurrent) {
      void onGiveUp();
    } else {
      void onJoin(project.id);
    }
  }

  return (
    <article
      className={`project-card ${project.isSignedUp ? "project-card-current" : ""}`}
      tabIndex={0}
      onClick={() => onSelect(project.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(project.id);
        }
      }}
      aria-label={`${project.title}, ${project.signupCount} participants`}
    >
      <div className="card-topline">
        <span>{project.signupCount} signed up</span>
        {project.isSignedUp ? <strong>Your project</strong> : null}
      </div>
      <h3>{project.title}</h3>
      <p className="project-description">{project.shortDescription}</p>
      <ParticipantPreview project={project} />
      <div className="card-actions">
        <button type="button" className="secondary" onClick={() => onSelect(project.id)}>
          Details
        </button>
        <button type="button" onClick={handleCta}>
          {ctaLabel}
        </button>
      </div>
    </article>
  );
}

function ParticipantPreview({ project }: { project: ProjectCard }) {
  if (project.signupCount === 0) {
    return <p className="empty-copy">No participants yet. You could be first.</p>;
  }

  return (
    <div className="participant-list" aria-label="Participants">
      {project.participantNamesPreview.map((name, index) => (
        <span key={`${name}-${index}`}>{name}</span>
      ))}
      {project.remainingParticipantCount > 0 ? (
        <span>+{project.remainingParticipantCount} more</span>
      ) : null}
    </div>
  );
}

function ProjectDetailsPanel({
  isLoading,
  error,
  hasRequestedProject,
  project,
  currentProjectId,
  onJoin,
  onGiveUp,
  onRetry,
}: {
  isLoading: boolean;
  error: string | null;
  hasRequestedProject: boolean;
  project: ProjectDetails | null;
  currentProjectId: string | null;
  onJoin: (projectId: string) => Promise<void> | void;
  onGiveUp: () => Promise<void> | void;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <section className="panel details-panel details-loading" aria-busy="true" aria-live="polite">
        <p className="eyebrow">Project Details</p>
        <div className="skeleton-line skeleton-title" />
        <div className="skeleton-line skeleton-body" />
        <div className="skeleton-line skeleton-body" />
        <div className="metric-row skeleton-metric" />
      </section>
    );
  }

  if (hasRequestedProject && !project) {
    return (
      <section className="panel empty-panel">
        <p className="eyebrow">Project Details</p>
        <h2>Project unavailable</h2>
        <p>{error ?? "This project was not found or is no longer approved for public browsing."}</p>
        {error ? (
          <button type="button" className="secondary" onClick={onRetry}>
            Retry loading details
          </button>
        ) : null}
        <Link className="panel-link" to="/">
          Back to project board
        </Link>
      </section>
    );
  }

  if (!project) {
    return (
      <section className="panel empty-panel">
        <p className="eyebrow">Details</p>
        <h2>Select a project</h2>
        <p>Open any card to view the full participant list and choose your next action.</p>
      </section>
    );
  }

  const isCurrent = project.id === currentProjectId;
  const ctaLabel = isCurrent
    ? "Give up this project"
    : currentProjectId
      ? "Switch to this project"
      : "Join project";

  return (
    <section className="panel details-panel">
      <p className="eyebrow">Project Details</p>
      <h2>{project.title}</h2>
      <p>{project.shortDescription}</p>
      <div className="metric-row">
        <div>
          <strong>{project.signupCount}</strong>
          <span>participants</span>
        </div>
        {isCurrent ? <mark>Your current selection</mark> : null}
      </div>

      <div>
        <h3>Signed up</h3>
        {project.participantNames.length > 0 ? (
          <ul className="full-participants">
            {project.participantNames.map((name, index) => (
              <li key={`${name}-${index}`}>{name}</li>
            ))}
          </ul>
        ) : (
          <p className="empty-copy">Nobody has joined this project yet.</p>
        )}
      </div>

      <button
        type="button"
        className={isCurrent ? "danger" : ""}
        onClick={() => {
          void (isCurrent ? onGiveUp() : onJoin(project.id));
        }}
      >
        {ctaLabel}
      </button>
    </section>
  );
}

function ProposalForm({
  onSubmit,
  message,
}: {
  onSubmit: (title: string, shortDescription: string) => Promise<void> | void;
  message: string | null;
}) {
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedDescription = shortDescription.trim();
    setValidationError(null);

    if (!trimmedTitle || !trimmedDescription) {
      setValidationError("Title and short description are required.");
      return;
    }

    if (trimmedTitle.length > MAX_PROPOSAL_TITLE_LENGTH) {
      setValidationError(`Title must be ${MAX_PROPOSAL_TITLE_LENGTH} characters or fewer.`);
      return;
    }

    if (trimmedDescription.length > MAX_PROPOSAL_SHORT_DESCRIPTION_LENGTH) {
      setValidationError(
        `Short description must be ${MAX_PROPOSAL_SHORT_DESCRIPTION_LENGTH} characters or fewer.`,
      );
      return;
    }

    if (SCRIPT_TAG_REGEX.test(trimmedTitle) || SCRIPT_TAG_REGEX.test(trimmedDescription)) {
      setValidationError("Script tags are not allowed.");
      return;
    }

    void onSubmit(trimmedTitle, trimmedDescription);
    setTitle("");
    setShortDescription("");
  }

  return (
    <section className="panel proposal-panel">
      <p className="eyebrow">Propose</p>
      <h2>Suggest a new project</h2>
      <p>Ideas are saved as pending and stay hidden until manual review.</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="proposal-title">Title</label>
        <input
          id="proposal-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="AI changelog assistant"
          maxLength={MAX_PROPOSAL_TITLE_LENGTH}
          required
        />

        <label htmlFor="proposal-description">Short description</label>
        <textarea
          id="proposal-description"
          value={shortDescription}
          onChange={(event) => setShortDescription(event.target.value)}
          placeholder="What should participants build?"
          rows={4}
          maxLength={MAX_PROPOSAL_SHORT_DESCRIPTION_LENGTH}
          required
        />

        <button type="submit">Submit for review</button>
        {validationError ? (
          <p className="empty-copy" role="alert">
            {validationError}
          </p>
        ) : null}
        {message ? (
          <p className="success-message" role="status">
            {message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
