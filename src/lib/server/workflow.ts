export const CHECKLIST: { key: string; label: string; hint: string }[] = [
  { key: 'review', label: 'Review onboarding information', hint: 'Read the full submission and the follow-up flags.' },
  { key: 'duplicates', label: 'Check for existing or duplicate Google listings', hint: 'Search Maps by name, address, and phone. Do not create a new profile if one exists.' },
  { key: 'eligibility', label: 'Confirm business eligibility', hint: 'In-person contact, staffed location, signage, no virtual office or mailbox.' },
  { key: 'name', label: 'Confirm the public business name', hint: 'Real-world name only. No keywords or city names.' },
  { key: 'categories', label: 'Select Google categories', hint: 'Choose from Google’s current category list; one primary plus relevant secondaries.' },
  { key: 'address', label: 'Confirm address visibility and service areas', hint: 'Google’s rules decide, not preference. Hide address for service-area businesses without customer visits.' },
  { key: 'create', label: 'Create or claim the listing via Google’s official workflow', hint: 'Use the owner’s Google account invitation. Never ask for passwords.' },
  { key: 'access', label: 'Configure owner and manager access', hint: 'Owner keeps primary ownership; add Arclo and any listed staff as managers.' },
  { key: 'verification', label: 'Complete Google’s verification process', hint: 'Use whatever method Google offers. Verification is not guaranteed.' },
  { key: 'info', label: 'Add accurate business information', hint: 'Phone, website, links, description (client approved).' },
  { key: 'media', label: 'Upload approved media', hint: 'Only media the client has approved for publication.' },
  { key: 'services', label: 'Configure services, products, and attributes', hint: 'Only attributes Google offers for the chosen category.' },
  { key: 'links', label: 'Add website and booking links', hint: 'Confirm each link type is supported for the category.' },
  { key: 'hours', label: 'Review business hours and special hours', hint: 'Customer-facing availability only.' },
  { key: 'approval', label: 'Obtain client approval where needed', hint: 'Description, media, review responses as the client requested.' },
  { key: 'live', label: 'Confirm the profile is live and accurate', hint: 'Check the public Maps and Search appearance.' },
  { key: 'handoff', label: 'Provide the client with the profile link and hand-off information', hint: 'Include how to request changes and who owns what.' },
  { key: 'ongoing', label: 'Offer ongoing maintenance and review management', hint: 'If included in the agreement.' },
];

export const STATUSES = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'needs_clarification', label: 'Needs clarification' },
  { value: 'ready_for_setup', label: 'Ready for setup' },
  { value: 'verification_pending', label: 'Verification pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'optimization_in_progress', label: 'Optimization in progress' },
  { value: 'complete', label: 'Complete' },
] as const;

export type Status = (typeof STATUSES)[number]['value'];
export const STATUS_VALUES = STATUSES.map((s) => s.value) as string[];
export const statusLabel = (v: string) =>
  v === 'onboarding_incomplete' ? 'Onboarding incomplete' : (STATUSES.find((s) => s.value === v)?.label ?? v);
