// Built-in application form (version 0). Admin IT edits it with the form builder
// (PRD FORM-1, src/lib/forms.ts); these fields stay the "core" fields stored in columns.

export type FieldType = "text" | "textarea" | "select" | "number" | "url" | "tel";

export interface AppField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
  maxLength?: number;
}

export interface AppSection {
  title: string;
  desc: string;
  fields: AppField[];
}

export const INDUSTRIES = ["FinTech", "EdTech", "HealthTech", "AgriTech", "CleanTech", "SaaS", "E-Commerce", "AI/ML", "DeepTech", "ESDM / Hardware", "Other"];

export const APPLICATION_SECTIONS: AppSection[] = [
  {
    title: "Startup basics",
    desc: "Who you are and where you are based.",
    fields: [
      { key: "startupName", label: "Startup name", type: "text", required: true, placeholder: "e.g. NovaPay", maxLength: 120 },
      { key: "industry", label: "Industry", type: "select", required: true, options: INDUSTRIES },
      { key: "ventureStage", label: "Current stage", type: "select", required: true, options: ["Idea", "Prototype", "MVP", "Early revenue", "Growth"], help: "Helps us match you to pre-incubation, incubation or acceleration." },
      { key: "city", label: "City", type: "text", required: true, placeholder: "e.g. Patna", maxLength: 80 },
      { key: "state", label: "State", type: "text", required: true, placeholder: "e.g. Bihar", maxLength: 80 },
      { key: "website", label: "Website or product link", type: "url", placeholder: "https://", maxLength: 200 },
    ],
  },
  {
    title: "Founders & team",
    desc: "Reviewers look closely at the team.",
    fields: [
      { key: "founders", label: "Founders", type: "textarea", required: true, placeholder: "Name — role — background — LinkedIn (one per line)", help: "Include each founder's relevant experience.", maxLength: 2000 },
      { key: "teamSize", label: "Team size (including founders)", type: "number", required: true, placeholder: "e.g. 4" },
      { key: "phone", label: "Contact phone", type: "tel", required: true, placeholder: "+91", maxLength: 20 },
    ],
  },
  {
    title: "The venture",
    desc: "Be specific: numbers beat adjectives.",
    fields: [
      { key: "idea", label: "One-line pitch", type: "text", required: true, placeholder: "We help [audience] do [outcome] with [product].", help: "Shown in the public directory if you are approved.", maxLength: 200 },
      { key: "problem", label: "Problem", type: "textarea", required: true, placeholder: "Who has this problem, how painful is it, and how do they solve it today?", maxLength: 2000 },
      { key: "solution", label: "Solution & why you win", type: "textarea", required: true, placeholder: "What you are building and what makes it better than alternatives.", maxLength: 2000 },
      { key: "traction", label: "Traction so far", type: "textarea", placeholder: "Users, pilots, revenue, LOIs, awards. Write 'None yet' if you are at idea stage.", maxLength: 2000 },
    ],
  },
  {
    title: "Legal & funding",
    desc: "Registration is not required to apply for pre-incubation.",
    fields: [
      { key: "registrationStatus", label: "Registration status", type: "select", required: true, options: ["Not registered yet", "Private Limited", "LLP", "Partnership", "Proprietorship"] },
      { key: "cin", label: "CIN / registration number", type: "text", placeholder: "If registered", maxLength: 40 },
      { key: "dpiitNumber", label: "DPIIT recognition number", type: "text", placeholder: "If recognised", maxLength: 40 },
      { key: "fundingRaised", label: "Funding raised so far", type: "select", required: true, options: ["Bootstrapped", "Under ₹10 lakh", "₹10–50 lakh", "₹50 lakh–2 crore", "Above ₹2 crore"] },
    ],
  },
];

export const APPLICATION_FIELDS: AppField[] = APPLICATION_SECTIONS.flatMap((s) => s.fields);
