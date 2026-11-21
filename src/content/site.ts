// Single source of truth for public-site content.
// Every number shown on the website comes from here, so figures can never
// contradict each other across pages.
//
// ⚠️ DEMO DATA: all figures, calls, programmes, people and contacts below are
// placeholders. Real content is not available yet. At final deployment Admin IT
// pushes the real content through the admin panel (site_config, PRD WEB-6), and
// this file becomes the seed/default. IS_SAMPLE shows "Sample" tags until then.

export const IS_SAMPLE = true;

// Facts marked [cimpbiif.com] come from the organisation's own site (Wayback Machine,
// archived 22 Mar 2025) or CIMP documents; verify with CIMP before go-live.
export const SITE = {
  name: "CIMP-BIIF",
  // [cimpbiif.com about-us] — note: the client's overview document expands the name differently
  fullName: "CIMP Business Incubation and Innovation Foundation",
  hostInstitute: "Chandragupt Institute of Management Patna (CIMP)",
  tagline: "From idea to investable company, with every step on record.",
  intro:
    "CIMP-BIIF, the incubator of Chandragupt Institute of Management Patna, supports early-stage founders in Bihar with mentorship, funding access, infrastructure and a transparent, fully digital incubation process.",
};

// [cimpbiif.com footer]
export const SOCIAL = [
  { label: "LinkedIn", href: "https://www.linkedin.com/company/cimp-biif/" },
  { label: "X (Twitter)", href: "https://twitter.com/CIMPBIIF" },
  { label: "Facebook", href: "https://www.facebook.com/CIMPBIIF/" },
];

export const ADDRESS = "Mithapur Institutional Area, Mithapur (Near Old Bus Stand, Gate No. 1), Patna – 800001, Bihar";

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
  { title: "Mentor & investor network", deadline: "Always open", href: "/#contact" },
];

// Program names [cimpbiif.com homepage]; process and 16-week pre-incubation [cimp.ac.in/?p=2946];
// terms range [CIMP I&E Policy, 27 Sep 2022]. Durations/fees not published are marked "to be confirmed".
export const PROGRAMS = [
  {
    slug: "pre-incubation",
    stage: "Idea stage",
    name: "Pre-incubation",
    duration: "About 16 weeks",
    format: "With an institutional mentor at CIMP",
    forWho: "Students, researchers and first-time founders with an idea and a basic business plan.",
    benefits: ["Institutional mentor", "Business plan development", "Help with company registration"],
    includes: [
      "An institutional mentor to refine your idea and business plan",
      "Training and workshops on business models and pitching",
      "Help with company registration and IPR",
      "Preparing your plan for Bihar seed-fund approval by the Department of Industries",
    ],
    eligibility: ["A startup idea and a basic business plan", "Registration not required to start", "At least one committed founder"],
    outcome: "A refined business plan, ready for seed-fund approval and incubation.",
    terms: "To be confirmed by CIMP",
  },
  {
    slug: "incubation",
    stage: "Prototype / early venture",
    name: "Incubation",
    duration: "To be confirmed by CIMP",
    format: "Resident (co-working) or mentoring-only",
    forWho: "Registered startups building and launching their product, including Startup Bihar seed-fund recipients.",
    benefits: ["Co-working space", "Technical & business mentoring", "Investor & market linkages"],
    includes: [
      "Co-working space at the CIMP campus or B-Hub, Patna",
      "Technical and business mentoring",
      "Access to investors, industry and government networks",
      "IPR, compliance and internship support",
      "Guidance on Bihar Startup Policy and Startup India support",
    ],
    eligibility: [
      "Registered startup (Bihar registration needed for Bihar seed funding)",
      "Startups from outside Bihar: mentoring-only incubation under Startup India",
      "Not on equity terms with another incubator",
    ],
    outcome: "A market-ready product, early customers and readiness for venture funding.",
    terms: "Fee, equity (2–9.5%) or free support, as set in your incubation agreement",
  },
  {
    slug: "women-entrepreneurship",
    stage: "All stages",
    name: "Women Entrepreneurship Development Programme",
    duration: "To be confirmed by CIMP",
    format: "To be confirmed by CIMP",
    forWho: "Women founders and aspiring women entrepreneurs.",
    benefits: ["Entrepreneurship training", "Mentoring", "Peer network"],
    includes: ["Entrepreneurship training and workshops", "Mentoring from experienced founders", "A peer network of women entrepreneurs"],
    eligibility: ["Women founders or aspiring entrepreneurs", "Detailed criteria to be confirmed by CIMP"],
    outcome: "Skills, confidence and a network to start or grow a venture.",
    terms: "To be confirmed by CIMP",
  },
  {
    slug: "certificate-entrepreneurship",
    stage: "Learning",
    name: "Certificate Programme in Entrepreneurship",
    duration: "To be confirmed by CIMP",
    format: "To be confirmed by CIMP",
    forWho: "Students, professionals and aspiring founders who want a structured grounding in entrepreneurship.",
    benefits: ["Structured curriculum", "Case studies", "Certificate from CIMP"],
    includes: ["A structured entrepreneurship curriculum", "Case studies and guest sessions", "A certificate on completion"],
    eligibility: ["Open to students and professionals", "Detailed criteria to be confirmed by CIMP"],
    outcome: "A practical foundation to start a venture.",
    terms: "To be confirmed by CIMP",
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
  "Founders with an innovative, scalable idea or product (idea stage welcome for pre-incubation)",
  // [cimp.ac.in/?p=2946] seed funding is only for Startup Bihar projects
  "For Bihar seed-fund support: startup registered in Bihar and not more than 5 years old",
  "Startups from outside Bihar are welcome for mentoring-only incubation under Startup India",
  "Not currently incubated at another incubator on equity terms",
];

export const RESPONSE_TIME = "Decision status visible in your dashboard at every stage";

// Indicative summaries of public schemes. Amounts and rules change; the official
// guidelines (linked) always prevail. CIMP to confirm which schemes it operates.
export const SCHEME_DETAILS = [
  {
    // [cimp.ac.in/?p=2946] CIMP's seed-funding route; portal from CIMP press release, Jan 2025
    ministry: "Department of Industries, Govt. of Bihar",
    name: "Bihar Startup Policy: seed funding",
    support: "Seed funding for Startup Bihar projects, approved by the Department of Industries after pre-incubation",
    forWho: "Startups registered in Bihar and not more than 5 years old",
    howWeHelp: "CIMP-BIIF is our primary route to seed funding: we mentor you through pre-incubation and forward your business plan to the Department of Industries for approval.",
    url: "https://startupbihar.in/",
  },
  {
    ministry: "DPIIT, Startup India",
    name: "Startup India Seed Fund Scheme (SISFS)",
    support: "Grant for proof of concept, prototype and trials; convertible debentures or debt for market entry and scaling",
    forWho: "DPIIT-recognised startups at an early stage",
    howWeHelp: "Selected incubators evaluate and disburse SISFS funds. We help you prepare and submit the application.",
    url: "https://seedfund.startupindia.gov.in/",
  },
  {
    ministry: "DST, Govt. of India",
    name: "NIDHI-PRAYAS",
    support: "Grant to turn an idea into a working prototype",
    forWho: "Innovators and early-stage founders with a hardware or deep-tech idea",
    howWeHelp: "Guidance on eligibility and proposal preparation; available through PRAYAS centres.",
    url: "https://nidhi.dst.gov.in/",
  },
  {
    ministry: "DST, Govt. of India",
    name: "NIDHI-EIR (Entrepreneur in Residence)",
    support: "Monthly fellowship so you can work on your startup full time",
    forWho: "Aspiring entrepreneurs, including recent graduates, pursuing a tech idea",
    howWeHelp: "We help you apply and pair the fellowship with pre-incubation.",
    url: "https://nidhi.dst.gov.in/",
  },
  {
    ministry: "MeitY",
    name: "GENESIS",
    support: "Support for tech startups, with a focus on Tier-II and Tier-III cities",
    forWho: "Early-stage technology startups outside the large metros",
    howWeHelp: "We connect eligible incubatees to the programme and its partner network.",
    url: "https://msh.meity.gov.in/",
  },
  {
    ministry: "DBT / BIRAC",
    name: "Biotechnology Ignition Grant (BIG)",
    support: "Grant to establish proof of concept for biotech, medtech and healthcare ideas",
    forWho: "Startups and entrepreneurs in life sciences and healthcare",
    howWeHelp: "Help preparing the proposal and connecting with BIRAC partners.",
    url: "https://birac.nic.in/",
  },
];

export const SCHEMES = SCHEME_DETAILS.reduce<{ ministry: string; items: string[] }[]>((groups, s) => {
  const g = groups.find((x) => x.ministry === s.ministry);
  if (g) g.items.push(s.name);
  else groups.push({ ministry: s.ministry, items: [s.name] });
  return groups;
}, []);

export const APPLY_GUIDE = {
  documents: [
    "Founder details: names, roles, background and LinkedIn links",
    "Company registration (CIN) and DPIIT number, if any",
    "One-line pitch, problem, solution and traction",
    "Pitch deck (PDF or PowerPoint, up to 5 MB)",
  ],
  tips: [
    "Lead with the problem and who has it. Numbers beat adjectives.",
    "Show traction honestly, even if it is 'none yet' at idea stage.",
    "Explain why your team is the right one to solve this.",
    "Keep the deck to 10–12 slides.",
  ],
  afterSelection: [
    "Onboarding call with the incubation team",
    "Incubation agreement and any terms for your program",
    "Mentor assignment and a 90-day plan",
    "Optional listing in the public startup directory",
  ],
};

// Sample network. In Phase 1 this comes from approved mentor/investor profiles (PRD MEN-1, PUB-1).
export type NetworkMember = {
  name: string; role: string; expertise: string;
  type: "Mentor" | "Investor" | "Mentor & Investor"; sectors: string[];
  /** public profile page; only for real (database) profiles */
  href?: string;
};

export const MENTORS: NetworkMember[] = [
  { name: "Mentor name", role: "Former CXO, FinTech", expertise: "Go-to-market, fundraising", type: "Mentor", sectors: ["FinTech", "SaaS"] },
  { name: "Mentor name", role: "Professor, Electronics", expertise: "Hardware, IP & patents", type: "Mentor", sectors: ["ESDM / Hardware", "DeepTech"] },
  { name: "Investor name", role: "Angel investor", expertise: "Seed-stage SaaS & consumer", type: "Investor", sectors: ["SaaS", "E-Commerce"] },
  { name: "Mentor name", role: "Founder, HealthTech", expertise: "Regulatory, clinical pilots", type: "Mentor", sectors: ["HealthTech"] },
  { name: "Mentor name", role: "Agri-value-chain specialist", expertise: "Farmer networks, supply chain", type: "Mentor", sectors: ["AgriTech"] },
  { name: "Investor name", role: "Partner, early-stage fund", expertise: "Climate and energy ventures", type: "Investor", sectors: ["CleanTech", "DeepTech"] },
  { name: "Mentor name", role: "Chartered accountant", expertise: "Compliance, finance, fundraising documents", type: "Mentor", sectors: ["All sectors"] },
  { name: "Mentor name", role: "Serial founder, EdTech", expertise: "Product, growth, hiring", type: "Mentor & Investor", sectors: ["EdTech", "AI/ML"] },
];

export const FACILITIES = {
  intro: "Shared infrastructure so incubatees can build, test and meet without heavy upfront costs.",
  // B-Hub: third-party press (telanganatoday.com Mar 2023; indianmasterminds.com Apr 2023). Seat counts in
  // other reports are unverified and deliberately not shown.
  bhub: {
    name: "B-Hub, Patna",
    location: "Maurya Lok complex, Patna",
    summary: "Bihar's startup hub, managed by CIMP-BIIF with the Department of Industries, Government of Bihar. Inaugurated on 8 February 2023.",
    features: [
      "Co-working seats bookable daily, monthly or yearly by Bihar-registered startups",
      "Wi-Fi and a conference hall with audio-visual equipment",
      "Market linkage and investor-connect sessions",
      "Pitch-deck clinics and mentorship",
    ],
  },
  spaces: [
    { name: "Co-working space", detail: "Open desks and dedicated seats with high-speed internet, for resident incubatees.", capacity: "Seats: to be provided by CIMP" },
    { name: "Meeting & board rooms", detail: "Bookable rooms with displays for investor meetings, mentor sessions and reviews.", capacity: "Rooms: to be provided by CIMP" },
    { name: "Event & pitch hall", detail: "Space for demo days, workshops and community events.", capacity: "Capacity: to be provided by CIMP" },
  ],
  labs: [
    { name: "Prototyping lab", items: ["3D printers", "Hand tools and workbenches", "Basic electronics kits"] },
    { name: "Electronics lab", items: ["Oscilloscopes and multimeters", "Soldering stations", "Microcontroller dev boards"] },
    { name: "Digital studio", items: ["Video and podcast recording kit", "Design workstations"] },
  ],
  booking: [
    "Incubatees book rooms and lab slots through the incubation team (in-portal booking is planned).",
    "Lab use may carry consumables charges; any charges are listed in your program terms.",
    "Non-incubatee access on request, subject to availability.",
  ],
};

export const PARTNERS = [
  "Government partner",
  "Ministry / department",
  "Industry partner",
  "Academic partner",
  "Investor network",
  "CSR partner",
];

// Contact routes by audience. Placeholders until CIMP provides real addresses.
// [cimpbiif.com contact] startup@cimp.ac.in is the published address. The old site's
// phone number looked like a placeholder, so no phone is shown until CIMP confirms one.
export const CONTACTS = [
  { audience: "Startups & applicants", value: "startup@cimp.ac.in" },
  { audience: "Mentors & investors", value: "startup@cimp.ac.in" },
  { audience: "Partners & CSR", value: "To be provided by CIMP" },
  { audience: "Visit us", value: ADDRESS },
];

export const ABOUT = {
  // [cimpbiif.com about-us]
  vision: "To contribute to socio-economic development by building an inclusive entrepreneurial ecosystem.",
  mission:
    "To create a culture of innovation by empowering startups with impactful incubation, robust training, state-of-the-art infrastructure and resourceful networks, and to make Bihar a leading destination for startups in India.",
  story: [
    "CIMP-BIIF began in 2017 as the Startup Incubation Centre (SIC) of Chandragupt Institute of Management Patna.",
    "In 2021 it became a Section 8 company, CIMP Business Incubation and Innovation Foundation, with support from the Department of Industries, Government of Bihar.",
    "It has contributed to the formulation and implementation of Bihar's startup policies, and brings together entrepreneurs, students, professionals, business leaders and investors.",
  ],
  hostedBy: "Host institute: Chandragupt Institute of Management Patna (CIMP), an autonomous institution set up in 2008 with support from the Government of Bihar",
  established: "Started in 2017 as the Startup Incubation Centre; incorporated as a Section 8 company in 2021",
  recognitions: [
    "Section 8 (not-for-profit) company, fully owned by CIMP",
    "Supported by the Department of Industries, Government of Bihar; empanelled under the Bihar Startup Policy",
    "Manages B-Hub, Bihar's startup hub at Maurya Lok, Patna, with the Department of Industries",
  ],
  sectors: ["FinTech", "EdTech", "E-Commerce", "HealthTech", "Social Enterprise", "Ad-Tech"],
  services: [
    "Technical and business mentoring",
    "Co-working space",
    "Company registration support",
    "Intellectual property (IPR) support",
    "Training and workshops",
    "Internship support",
    "Access to networks: investors, industry and government",
    "Business development assistance",
    "Access to government schemes and policies",
    "Faster access to investment opportunities",
  ],
  pillars: [
    { title: "Mentorship", desc: "Every incubatee gets an institutional mentor and access to a network of domain experts." },
    { title: "Funding access", desc: "Support with Bihar Startup Policy seed funding, other government schemes and investor introductions." },
    { title: "Infrastructure", desc: "Co-working at the CIMP campus and at B-Hub, Patna, plus meeting and event spaces." },
    { title: "Transparent process", desc: "A digital, auditable review with status, remarks and decisions visible at every stage." },
  ],
  // [cimpbiif.com about-us, archived Mar 2025] — confirm current office-holders with CIMP
  leadership: [
    { name: "Prof. (Dr.) Rana Singh", role: "Director, CIMP and CIMP-BIIF" },
    { name: "Kumod Kumar", role: "Chief Executive Officer, CIMP-BIIF" },
  ],
  // Third-party press: Venture Catalysts MoU (indiacsr.in, May 2022), T-Hub MoU (telanganatoday.com, Mar 2023)
  partners: [
    "Department of Industries, Government of Bihar",
    "T-Hub, Hyderabad (MoU, 2023)",
    "Venture Catalysts (MoU, 2022)",
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
      { q: "Does CIMP-BIIF take equity?", a: "Under CIMP's Innovation & Entrepreneurship Policy, support can be offered for a fee, for equity (between 2% and 9.5%) or free of cost. The terms for your program are set out in your incubation agreement before you join." },
      { q: "Who owns my IP?", a: "You do. Any specific terms are set out in the incubation agreement you sign after selection." },
      { q: "Is remote (virtual) incubation possible?", a: "Programme formats will be confirmed by CIMP. Mentoring and reviews already run online through the portal." },
      { q: "How does seed funding work?", a: "Seed funding is available for Startup Bihar projects: startups registered in Bihar and not more than 5 years old. After about 16 weeks of pre-incubation with an institutional mentor, your business plan is sent to the Department of Industries, Government of Bihar, for approval." },
      { q: "Which government schemes can you help with?", a: "Mainly the Bihar Startup Policy, plus guidance on central schemes such as SISFS, NIDHI-PRAYAS, NIDHI-EIR, GENESIS and BIRAC BIG. See the Schemes page." },
      { q: "I am not from Bihar. Can I apply?", a: "Yes. Startups from outside Bihar can receive mentoring-only incubation under Startup India; Bihar seed funding requires Bihar registration." },
    ],
  },
];

// ── From the organisation's own site (cimpbiif.com, Wayback Machine, archived 22 Mar 2025).
//    Verbatim where quoted; confirm currency with CIMP before go-live. ──

export const LEADERSHIP_MESSAGES = [
  {
    name: "Prof. (Dr.) Rana Singh",
    role: "Director, CIMP and CIMP-BIIF",
    photo: "/team/rana-singh.png",
    message:
      "At CIMP-BIIF, we are building a world-class innovation ecosystem. Our aim is to nurture entrepreneurs and future leaders by helping them grow with institutional support. With India emerging as the fourth largest startup ecosystem in the world, it is our privilege to give young entrepreneurial minds a relevant platform. BIIF not only provides support and guidance to young leaders but also helps them establish their own units, using the best technology and infrastructure.",
  },
  {
    name: "Kumod Kumar",
    role: "Chief Executive Officer, CIMP-BIIF",
    photo: "/team/kumod-kumar.png",
    message:
      "At BIIF, we believe in the power of imagination, ideation and incubation. We work closely with various stakeholders to handhold young innovators in their journey from an innovative idea to a viable enterprise. The idea is to create a strong culture of entrepreneurship where young minds will have a greater appetite for job creation rather than job seeking.",
  },
];

export const HOST_INSTITUTE = {
  name: "Chandragupt Institute of Management Patna (CIMP)",
  points: [
    "Established in 2008 as an autonomous institution with support from the Government of Bihar",
    "Among the top 125 management institutes in India in the NIRF 2023 ranking (Ministry of Education)",
    "Two-year PGDM approved by AICTE, accredited by NBA and recognised by AIU as equivalent to an MBA",
    "AICTE-approved PGDM in Innovation, Entrepreneurship & Venture Development (PGDM-IEV)",
    "Fellow Programme in Management (FPM) and Executive Fellow Programme in Management (EFPM)",
  ],
};

export const POLICIES = [
  {
    name: "CIMP Innovation & Entrepreneurship Policy",
    desc: "CIMP's policy for an ecosystem of innovation, entrepreneurship and startups, in line with the National Innovation and Startup Policy 2019.",
    vision: "To make CIMP, Patna the most preferred destination for innovators, entrepreneurs and startups of the state.",
    mission: "To encourage, establish and nurture a vital startup ecosystem in the institute, triggering innovation and entrepreneurship for the benefit of society.",
  },
  {
    name: "National Innovation and Startup Policy (NISP) 2019",
    desc: "The Ministry of Education's framework that helps higher education institutions engage students, faculty and staff in innovation and entrepreneurship, including IP ownership, technology licensing and startup policies.",
  },
];

// "Our Entrepreneurial Endeavours" on the old homepage (titles only were published).
export const ENDEAVOURS = [
  { name: "PGDM-IEV", desc: "CIMP's AICTE-approved PGDM in Innovation, Entrepreneurship & Venture Development." },
  { name: "100 Steps to Startups", desc: "A step-by-step entrepreneurship initiative. Details to be confirmed by CIMP." },
  { name: "Digital Marketing Course", desc: "Practical digital marketing skills for founders. Details to be confirmed by CIMP." },
  { name: "Startups Tagged by the Department of Industries", desc: "Startups linked to CIMP-BIIF through the Department of Industries, Government of Bihar." },
];

// "Our Key Focus Areas" on the old homepage: the 17 UN Sustainable Development Goals.
export const SDGS = [
  "No Poverty", "Zero Hunger", "Good Health and Well-Being", "Quality Education", "Gender Equality",
  "Clean Water and Sanitation", "Affordable and Clean Energy", "Decent Work and Economic Growth",
  "Industry, Innovation and Infrastructure", "Reduced Inequalities", "Sustainable Cities and Communities",
  "Responsible Consumption and Production", "Climate Action", "Life Below Water", "Life on Land",
  "Peace, Justice and Strong Institutions", "Partnerships for the Goals",
];
