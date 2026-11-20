// Single source of truth for public-site content.
// Every number shown on the website comes from here, so figures can never
// contradict each other across pages.
//
// ⚠️ DEMO DATA: all figures, calls, programmes, people and contacts below are
// placeholders. Real content is not available yet. At final deployment Admin IT
// pushes the real content through the admin panel (site_config, PRD WEB-6), and
// this file becomes the seed/default. IS_SAMPLE shows "Sample" tags until then.

export const IS_SAMPLE = true;

export const SITE = {
  name: "CIMP-BIIF",
  fullName: "Centre for Innovation, Management & Policy — Business Incubation & Innovation Fund",
  tagline: "From idea to investable company, with every step on record.",
  intro:
    "CIMP-BIIF supports early-stage founders with mentorship, funding access, infrastructure and a transparent, fully digital incubation process.",
};

export const STATS = {
  asOf: "31 Mar 2026",
  source: "CIMP-BIIF records",
  items: [
    { value: "120+", label: "Startups supported" },
    { value: "60+", label: "Mentors & experts" },
    { value: "₹25 Cr+", label: "Funding facilitated" },
    { value: "15+", label: "Government & industry partners" },
  ],
};

export const OPEN_CALLS = [
  { title: "Incubation — Cohort 2027", deadline: "15 Jan 2027", href: "/register" },
  { title: "Pre-incubation — Rolling intake", deadline: "Rolling", href: "/register" },
  { title: "Mentor & investor network", deadline: "Always open", href: "#contact" },
];

export const PROGRAMS = [
  {
    stage: "Idea stage",
    name: "Pre-incubation",
    duration: "3 months",
    forWho: "Students, researchers and first-time founders with an idea or early prototype.",
    benefits: ["Weekly mentor sessions", "Problem & market validation", "Help with company registration"],
    terms: "No equity, no fee",
  },
  {
    stage: "Prototype / MVP",
    name: "Incubation",
    duration: "12 months (extendable)",
    forWho: "Registered startups with a working prototype or MVP.",
    benefits: ["Dedicated mentor", "Office & lab access", "Seed-fund & scheme applications"],
    terms: "Terms shared before you apply",
  },
  {
    stage: "Early revenue",
    name: "Acceleration",
    duration: "6 months",
    forWho: "Startups with early customers preparing to scale or raise.",
    benefits: ["Investor connects & demo day", "Industry pilots", "CXO-level mentoring"],
    terms: "Terms shared before you apply",
  },
];

// Mirrors the portal's real approval workflow (src/lib/workflow.ts).
export const APPLY_STEPS = [
  { title: "Apply online", desc: "Create an account, verify your email and submit your application with documents." },
  { title: "Executive review", desc: "The office checks completeness and eligibility." },
  { title: "Due diligence", desc: "An Incubation Manager evaluates your venture and records remarks." },
  { title: "Signed approval", desc: "Senior Manager and CEO approve with digital signatures. You are notified at every step." },
];

export const ELIGIBILITY = [
  "Indian founders with an innovative, scalable product or service",
  "Prototype or MVP for incubation (idea stage welcome for pre-incubation)",
  "Registered entity, or willingness to register during the programme",
  "Not currently incubated at another incubator on equity terms",
];

export const RESPONSE_TIME = "Decision status visible in your dashboard at every stage";

export const SCHEMES = [
  { ministry: "DPIIT, Startup India", items: ["Startup India Seed Fund Scheme (SISFS)"] },
  { ministry: "DST, Govt. of India", items: ["NIDHI-PRAYAS", "NIDHI-EIR"] },
  { ministry: "MeitY", items: ["GENESIS"] },
  { ministry: "DBT / BIRAC", items: ["Biotechnology Ignition Grant (BIG)"] },
];

export const MENTORS = [
  { name: "Mentor name", role: "Former CXO, FinTech", expertise: "Go-to-market, fundraising" },
  { name: "Mentor name", role: "Professor, Electronics", expertise: "Hardware, IP & patents" },
  { name: "Investor name", role: "Angel investor", expertise: "Seed-stage SaaS & consumer" },
  { name: "Mentor name", role: "Founder, HealthTech", expertise: "Regulatory, clinical pilots" },
];

export const PARTNERS = [
  "Government partner",
  "Ministry / department",
  "Industry partner",
  "Academic partner",
  "Investor network",
  "CSR partner",
];

// Contact routes by audience. Placeholders until CIMP provides real addresses.
export const CONTACTS = [
  { audience: "Startups & applicants", value: "To be provided by CIMP" },
  { audience: "Mentors & investors", value: "To be provided by CIMP" },
  { audience: "Partners & CSR", value: "To be provided by CIMP" },
  { audience: "Media", value: "To be provided by CIMP" },
];

export const ABOUT = {
  mission:
    "To help early-stage founders turn innovative ideas into sustainable, investable companies, through mentorship, funding access, infrastructure and a transparent incubation process.",
  vision:
    "A thriving regional startup ecosystem where every promising founder can access the support they need, regardless of background.",
  hostedBy: "Host institution: to be provided by CIMP",
  established: "Year established: to be provided by CIMP",
  recognitions: [
    "Government recognition / scheme partner: to be provided by CIMP",
    "DPIIT / Startup India affiliation: to be provided by CIMP",
    "Legal entity (e.g. Section 8 company): to be provided by CIMP",
  ],
  pillars: [
    { title: "Mentorship", desc: "Every incubatee gets a dedicated mentor and access to a network of domain experts." },
    { title: "Funding access", desc: "Support with seed-fund applications, government schemes and investor introductions." },
    { title: "Infrastructure", desc: "Office space, labs and shared facilities for building and testing products." },
    { title: "Transparent process", desc: "A digital, auditable review with status, remarks and decisions visible at every stage." },
  ],
  leadership: [
    { name: "Leader name", role: "Chief Executive Officer" },
    { name: "Leader name", role: "Senior Manager, Incubation" },
    { name: "Leader name", role: "Incubation Manager" },
  ],
  governance:
    "Applications are reviewed in four stages: Executive review, Incubation Manager due diligence, Senior Manager approval and CEO final approval. Senior Manager and CEO decisions are digitally signed, and every action is recorded in an audit log.",
};

export const FAQS: { category: string; items: { q: string; a: string }[] }[] = [
  {
    category: "Eligibility",
    items: [
      { q: "Who can apply?", a: "Founders with an innovative, scalable idea or product. Students, researchers and first-time founders are welcome for pre-incubation; incubation expects a prototype or MVP." },
      { q: "Do I need a registered company?", a: "Not for pre-incubation. For incubation, a registered entity is preferred, or you can register during the programme." },
      { q: "Can I apply if I am incubated elsewhere?", a: "Generally not if the other incubator holds equity. Contact us to discuss your case." },
    ],
  },
  {
    category: "Process",
    items: [
      { q: "How does the review work?", a: "Your application goes through Executive review, Incubation Manager due diligence, Senior Manager approval and CEO final approval. You can follow each step on your dashboard." },
      { q: "How long does a decision take?", a: "Timelines depend on the call and volume. Your dashboard always shows which stage you are in and for how long." },
      { q: "Will I get feedback if I am not selected?", a: "Yes. If an application is not approved, the reason is shared with you on your dashboard." },
      { q: "Can I edit my application after submitting?", a: "Yes, until the Executive accepts it for review. After that it is locked so reviewers assess a stable version." },
    ],
  },
  {
    category: "Terms & support",
    items: [
      { q: "Does CIMP-BIIF take equity?", a: "Terms differ by program and are listed on each program card. Pre-incubation is free with no equity." },
      { q: "Who owns my IP?", a: "You do. Any specific terms are set out in the incubation agreement you sign after selection." },
      { q: "Is remote (virtual) incubation possible?", a: "Programme formats will be confirmed by CIMP. Mentoring and reviews already run online through the portal." },
      { q: "Which government schemes can you help with?", a: "Schemes such as SISFS, NIDHI-PRAYAS, NIDHI-EIR, GENESIS and BIRAC BIG, depending on which ones CIMP operates." },
    ],
  },
];
