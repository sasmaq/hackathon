import {
  Component,
  FormEvent,
  MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  giveUpProject,
  joinProject,
  loadCurrentProjectId,
  loadIdentity,
  loadProjectCards,
  loadProjectDetails,
  proposeProject,
  saveIdentity,
  updateDisplayName,
} from "./data";
import type { Identity, ProjectCard, ProjectDetails } from "./types";

const PAGE_SIZE = 6;

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
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [proposalMessage, setProposalMessage] = useState<string | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);

  const visibleProjects = useMemo(
    () => projectCards.slice(0, visibleCount),
    [projectCards, visibleCount],
  );

  function refresh(nextIdentity = identity, withLoadingPlaceholder = false) {
    if (!nextIdentity) {
      return;
    }

    if (refreshTimeoutRef.current) {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }

    const applyRefresh = () => {
      setProjectCards(loadProjectCards(nextIdentity));
      setCurrentProjectId(loadCurrentProjectId(nextIdentity));
      setIsProjectsLoading(false);
    };

    if (!withLoadingPlaceholder) {
      applyRefresh();
      return;
    }

    setIsProjectsLoading(true);
    refreshTimeoutRef.current = window.setTimeout(() => {
      applyRefresh();
      refreshTimeoutRef.current = null;
    }, 180);
  }

  useEffect(() => {
    if (!identity) {
      setProjectCards([]);
      setCurrentProjectId(null);
      setIsProjectsLoading(false);
      return;
    }

    refresh(identity, true);
    return () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, [identity?.clientId]);

  useEffect(
    () => () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [projectCards.length]);

  function handleStart(displayName: string) {
    const nextIdentity = saveIdentity(displayName);
    setIdentity(nextIdentity);
    void navigate("/");
  }

  function handleRename(displayName: string) {
    if (!identity) {
      return;
    }

    const nextIdentity = updateDisplayName(identity, displayName);
    setIdentity(nextIdentity);
    refresh(nextIdentity, true);
  }

  function handleJoin(projectId: string) {
    if (!identity) {
      return;
    }

    joinProject(identity, projectId);
    refresh(identity, true);
    void navigate(`/project/${projectId}`);
  }

  function handleGiveUp() {
    if (!identity) {
      return;
    }

    giveUpProject(identity);
    refresh(identity, true);
  }

  function handleProposal(title: string, shortDescription: string) {
    proposeProject(title, shortDescription);
    setProposalMessage(
      "Thanks. Your project idea is pending manual review before it appears here.",
    );
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
                projects={visibleProjects}
                totalCount={projectCards.length}
                isProjectsLoading={isProjectsLoading}
                currentProjectId={currentProjectId}
                selectedProject={null}
                isDetailsLoading={false}
                hasRequestedProject={false}
                proposalMessage={proposalMessage}
                showProposal={false}
                onSelect={(projectId) => {
                  void navigate(`/project/${projectId}`);
                }}
                onJoin={handleJoin}
                onGiveUp={handleGiveUp}
                onLoadMore={() =>
                  setVisibleCount((count) => Math.min(count + PAGE_SIZE, projectCards.length))
                }
                onProposal={handleProposal}
              />
            }
          />
          <Route
            path="/project/:projectId"
            element={
              <ProjectRoute
                identity={identity}
                projects={visibleProjects}
                totalCount={projectCards.length}
                isProjectsLoading={isProjectsLoading}
                currentProjectId={currentProjectId}
                proposalMessage={proposalMessage}
                onSelect={(projectId) => {
                  void navigate(`/project/${projectId}`);
                }}
                onJoin={handleJoin}
                onGiveUp={handleGiveUp}
                onLoadMore={() =>
                  setVisibleCount((count) => Math.min(count + PAGE_SIZE, projectCards.length))
                }
                onProposal={handleProposal}
              />
            }
          />
          <Route
            path="/propose"
            element={
              <ProjectBoard
                projects={visibleProjects}
                totalCount={projectCards.length}
                isProjectsLoading={isProjectsLoading}
                currentProjectId={currentProjectId}
                selectedProject={null}
                isDetailsLoading={false}
                hasRequestedProject={false}
                proposalMessage={proposalMessage}
                showProposal
                onSelect={(projectId) => {
                  void navigate(`/project/${projectId}`);
                }}
                onJoin={handleJoin}
                onGiveUp={handleGiveUp}
                onLoadMore={() =>
                  setVisibleCount((count) => Math.min(count + PAGE_SIZE, projectCards.length))
                }
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
  isProjectsLoading,
  currentProjectId,
  proposalMessage,
  onSelect,
  onJoin,
  onGiveUp,
  onLoadMore,
  onProposal,
}: {
  identity: Identity;
  projects: ProjectCard[];
  totalCount: number;
  isProjectsLoading: boolean;
  currentProjectId: string | null;
  proposalMessage: string | null;
  onSelect: (projectId: string) => void;
  onJoin: (projectId: string) => void;
  onGiveUp: () => void;
  onLoadMore: () => void;
  onProposal: (title: string, shortDescription: string) => void;
}) {
  const { projectId } = useParams();
  const selectedProject = projectId ? loadProjectDetails(projectId, identity) : null;
  const [isDetailsLoading, setIsDetailsLoading] = useState(Boolean(projectId));

  useEffect(() => {
    if (!projectId) {
      setIsDetailsLoading(false);
      return;
    }

    setIsDetailsLoading(true);
    const timer = window.setTimeout(() => setIsDetailsLoading(false), 180);
    return () => window.clearTimeout(timer);
  }, [identity.clientId, projectId]);

  return (
    <ProjectBoard
      projects={projects}
      totalCount={totalCount}
      isProjectsLoading={isProjectsLoading}
      currentProjectId={currentProjectId}
      selectedProject={selectedProject}
      isDetailsLoading={isDetailsLoading}
      hasRequestedProject={Boolean(projectId)}
      proposalMessage={proposalMessage}
      showProposal={false}
      onSelect={onSelect}
      onJoin={onJoin}
      onGiveUp={onGiveUp}
      onLoadMore={onLoadMore}
      onProposal={onProposal}
    />
  );
}

function ProjectBoard({
  projects,
  totalCount,
  isProjectsLoading,
  currentProjectId,
  selectedProject,
  isDetailsLoading,
  hasRequestedProject,
  proposalMessage,
  showProposal,
  onSelect,
  onJoin,
  onGiveUp,
  onLoadMore,
  onProposal,
}: {
  projects: ProjectCard[];
  totalCount: number;
  isProjectsLoading: boolean;
  currentProjectId: string | null;
  selectedProject: ProjectDetails | null;
  isDetailsLoading: boolean;
  hasRequestedProject: boolean;
  proposalMessage: string | null;
  showProposal: boolean;
  onSelect: (projectId: string) => void;
  onJoin: (projectId: string) => void;
  onGiveUp: () => void;
  onLoadMore: () => void;
  onProposal: (title: string, shortDescription: string) => void;
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
          isLoading={isProjectsLoading}
          currentProjectId={currentProjectId}
          onSelect={onSelect}
          onJoin={onJoin}
          onGiveUp={onGiveUp}
          onLoadMore={onLoadMore}
        />
      </div>

      <aside className="side-panel" aria-label="Project details and proposals">
        {showProposal ? (
          <ProposalForm onSubmit={onProposal} message={proposalMessage} />
        ) : (
          <>
            <ProjectDetailsPanel
              isLoading={isDetailsLoading}
              hasRequestedProject={hasRequestedProject}
              project={selectedProject}
              currentProjectId={currentProjectId}
              onJoin={onJoin}
              onGiveUp={onGiveUp}
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
  isLoading,
  currentProjectId,
  onSelect,
  onJoin,
  onGiveUp,
  onLoadMore,
}: {
  projects: ProjectCard[];
  totalCount: number;
  isLoading: boolean;
  currentProjectId: string | null;
  onSelect: (projectId: string) => void;
  onJoin: (projectId: string) => void;
  onGiveUp: () => void;
  onLoadMore: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const hasMore = projects.length < totalCount;

  useEffect(() => {
    if (!hasMore || !sentinelRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: "240px" },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  return (
    <>
      {isLoading ? (
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
      <div className="cards-grid">
        {!isLoading &&
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
        {isLoading ? <span>Loading projects...</span> : null}
        {hasMore ? (
          <button type="button" onClick={onLoadMore} disabled={isLoading}>
            Load more projects
          </button>
        ) : !isLoading ? (
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
  onJoin: (projectId: string) => void;
  onGiveUp: () => void;
}) {
  const isCurrent = project.id === currentProjectId;
  const ctaLabel = isCurrent ? "Give up" : currentProjectId ? "Switch here" : "Join project";

  function handleCta(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();

    if (isCurrent) {
      onGiveUp();
    } else {
      onJoin(project.id);
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
  hasRequestedProject,
  project,
  currentProjectId,
  onJoin,
  onGiveUp,
}: {
  isLoading: boolean;
  hasRequestedProject: boolean;
  project: ProjectDetails | null;
  currentProjectId: string | null;
  onJoin: (projectId: string) => void;
  onGiveUp: () => void;
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
        <p>This project was not found or is no longer approved for public browsing.</p>
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
        onClick={() => (isCurrent ? onGiveUp() : onJoin(project.id))}
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
  onSubmit: (title: string, shortDescription: string) => void;
  message: string | null;
}) {
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedDescription = shortDescription.trim();

    if (!trimmedTitle || !trimmedDescription) {
      return;
    }

    onSubmit(trimmedTitle, trimmedDescription);
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
          required
        />

        <label htmlFor="proposal-description">Short description</label>
        <textarea
          id="proposal-description"
          value={shortDescription}
          onChange={(event) => setShortDescription(event.target.value)}
          placeholder="What should participants build?"
          rows={4}
          required
        />

        <button type="submit">Submit for review</button>
        {message ? (
          <p className="success-message" role="status">
            {message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
