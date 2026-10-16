import type { Cond, Field, Step } from './types';

const eq = (f: string, v: string | number | boolean): Cond => ({ f, eq: v });
const not = (c: Cond): Cond => ({ not: c });

const needsPhone = not(eq('ownerPhoneSame', true));
const travels = eq('$travels', true);
const listed = eq('existingPresence', 'yes');

const note = (id: string, label: string, tone: Field['tone'], showIf?: Cond): Field => ({ id, type: 'notice', label, tone, showIf });

const business: Step = {
  id: 'business',
  title: 'Business information',
  short: 'Business',
  phase: 'Setup',
  fields: [
    { id: 'businessName', type: 'text', label: 'Business name', help: 'The exact name customers know you by.', required: true, maxLength: 150 },
    {
      id: 'whatWeDo',
      type: 'text',
      label: 'What does your business do?',
      help: 'A short description of your main business activity.',
      placeholder: 'e.g. Drywall repair and installation',
      required: true,
      maxLength: 300,
    },
    { id: 'phonePrimary', type: 'tel', label: 'Business phone number', required: true, half: true },
    { id: 'website', type: 'url', label: 'Business website (optional)', help: 'Leave blank if you don’t have one.', half: true },
    {
      id: 'existingPresence',
      type: 'radio',
      label: 'Is your business already listed on Google Maps?',
      required: true,
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
        { value: 'unsure', label: 'Not sure' },
      ],
    },
    { id: 'mapsUrl', type: 'url', label: 'Link to the listing (if you have it)', help: 'Search your business on Google Maps, tap Share, and paste the link.', showIf: listed },
  ],
};

const location: Step = {
  id: 'location',
  title: 'Location and service area',
  short: 'Location',
  phase: 'Setup',
  fields: [
    {
      id: 'serviceMode',
      type: 'radio',
      label: 'How do you serve customers?',
      required: true,
      options: [
        { value: 'visit', label: 'Customers visit my business location' },
        { value: 'travel', label: 'I travel to customers' },
        { value: 'both', label: 'Both' },
      ],
    },
    note(
      'n-address',
      'Enter your real operating address. Google may need it for verification even if it won’t be shown publicly.',
      'info',
    ),
    { id: 'addr_street', type: 'text', label: 'Street address', required: true, maxLength: 200 },
    { id: 'addr_city', type: 'text', label: 'City', required: true, half: true, maxLength: 100 },
    { id: 'addr_state', type: 'text', label: 'State', required: true, half: true, maxLength: 100 },
    { id: 'addr_zip', type: 'text', label: 'ZIP code', required: true, half: true, maxLength: 20 },
    { id: 'addr_country', type: 'text', label: 'Country', required: true, half: true, maxLength: 100, defaultValue: 'United States' },
    {
      id: 'customerVisits',
      type: 'radio',
      label: 'Do customers actually visit this address during your stated business hours?',
      required: true,
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ],
    },
    {
      id: 'saAreas',
      type: 'text',
      label: 'Which cities or areas do you serve?',
      help: 'List the cities, separated by commas.',
      placeholder: 'e.g. Monroe, Toledo, Ann Arbor',
      required: true,
      showIf: travels,
      maxLength: 500,
    },
  ],
};

const hours: Step = {
  id: 'hours',
  title: 'Business hours',
  short: 'Hours',
  phase: 'Setup',
  fields: [
    {
      id: 'hoursMode',
      type: 'radio',
      label: 'When are you open to customers?',
      help: 'List the hours customers can actually reach or visit you.',
      required: true,
      options: [
        { value: 'set', label: 'I have regular hours' },
        { value: '24-7', label: 'Open 24 hours, every day' },
        { value: 'appointment', label: 'By appointment only' },
      ],
    },
    {
      id: 'hours',
      type: 'hours',
      label: 'Weekly hours',
      help: 'Mark each day Open or Closed. Use “Add a second shift” for a lunch break.',
      showIf: eq('hoursMode', 'set'),
      requiredIf: eq('hoursMode', 'set'),
    },
  ],
};

const services: Step = {
  id: 'services',
  title: 'Services',
  short: 'Services',
  phase: 'Setup',
  fields: [
    {
      id: 'servicesText',
      type: 'textarea',
      label: 'What are the main services or products your business offers?',
      placeholder: 'Drywall repair, drywall installation, plaster repair, dustless sanding, and insulation.',
      required: true,
      maxLength: 2000,
    },
    {
      id: 'notOffered',
      type: 'textarea',
      label: 'Any services customers commonly ask about that you do NOT provide? (optional)',
      help: 'This keeps us from listing something you don’t offer.',
      maxLength: 1000,
    },
  ],
};

const google: Step = {
  id: 'google',
  title: 'Google account and verification',
  short: 'Google account',
  phase: 'Setup',
  fields: [
    note(
      'n-owner',
      'The business owner keeps ownership of the profile and gives Arclo manager access. Never send us your Google password or verification codes.',
      'good',
    ),
    { id: 'ownerName', type: 'text', label: 'Who should own the Google Business Profile? (full name)', required: true, maxLength: 120 },
    {
      id: 'ownerGoogleEmail',
      type: 'email',
      label: 'Their Google account email',
      help: 'Must be an email tied to a Google account (Gmail or Google Workspace).',
      required: true,
    },
    { id: 'ownerPhoneSame', type: 'checkbox', label: 'Best phone number for verification is the same as the business phone' },
    { id: 'ownerPhone', type: 'tel', label: 'Best phone number to reach the owner for verification', required: true, showIf: needsPhone },
    {
      id: 'verifyHelp',
      type: 'radio',
      label: 'Are you able to help with Google’s verification process if requested?',
      help: 'Google may ask you to verify by video, phone, email, or another method. Arclo will guide you through whichever one Google offers.',
      required: true,
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'assist', label: 'I need assistance' },
      ],
    },
  ],
};

const finish: Step = {
  id: 'finish',
  title: 'Photos and authorization',
  short: 'Photos & sign-off',
  phase: 'Setup',
  fields: [
    {
      id: 'mediaStatus',
      type: 'radio',
      label: 'Do you have a business logo and photos of your business or work?',
      required: true,
      options: [
        { value: 'upload', label: 'Yes, I can upload them' },
        { value: 'provided', label: 'I already provided these to Arclo' },
        { value: 'later', label: 'Not right now' },
      ],
    },
    { id: 'f-logo', type: 'files', category: 'logo', label: 'Logo (optional)', accept: 'image', maxFiles: 1, showIf: eq('mediaStatus', 'upload') },
    {
      id: 'f-photos',
      type: 'files',
      category: 'photos',
      label: 'Business or project photos (optional)',
      help: 'A few good ones are plenty.',
      accept: 'image',
      maxFiles: 20,
      showIf: eq('mediaStatus', 'upload'),
    },
    { id: 'completedBy', type: 'text', label: 'Your name, if you’re not the profile owner (optional)', maxLength: 120 },
    {
      id: 'consentAuthorize',
      type: 'checkbox',
      label:
        'I confirm that the information provided is accurate and that I authorize Arclo to use it to create, claim, and manage my Google Business Profile on behalf of my business. I understand that Google controls verification and profile eligibility.',
      required: true,
    },
  ],
};

export const STEPS: Step[] = [business, location, hours, services, google, finish];
export const STEP_BY_ID = Object.fromEntries(STEPS.map((s) => [s.id, s])) as Record<string, Step>;
