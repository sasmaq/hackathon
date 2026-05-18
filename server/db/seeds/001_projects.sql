insert into projects (id, title, short_description, status)
values
  (
    '8aa65ccd-fb89-46ce-8e74-5f15f8f2efea',
    'AI Trip Planner',
    'Build an assistant that creates personalized travel itineraries from user constraints.',
    'approved'
  ),
  (
    '6b1a53f5-5e49-4055-93ef-2c764ecf7838',
    'Mentor Matchmaker',
    'Pair learners with mentors by goals, timezone overlap, and skill level.',
    'approved'
  ),
  (
    '36e8f0d4-4a90-4305-bf0c-a2855a03cf5e',
    'Voice Notes Summarizer',
    'Convert voice memo batches into structured summaries and action items.',
    'pending'
  )
on conflict (id) do update
set
  title = excluded.title,
  short_description = excluded.short_description,
  status = excluded.status;
