/**
 * Standardized 20 forced-choice DISC assessment questions and profiling logic.
 * Conforms to the 12-profile neighbor algorithm: D, Di, iD, I, iS, Si, S, SC, CS, C, CD, DC.
 */

export interface DiscOption {
  dim: "D" | "I" | "S" | "C";
  text: string;
}

export interface DiscQuestion {
  questionNo: number;
  question: string;
  options: {
    key: "A" | "B" | "C" | "D";
    dim: "D" | "I" | "S" | "C";
    text: string;
  }[];
}

export const DISC_QUESTIONS_DATA: { question: string; D: string; I: string; S: string; C: string }[] = [
  {
    question: "When starting a major new project at work, your first reaction is to:",
    D: "Take charge, clarify the end goals, and set ambitious deadlines immediately.",
    I: "Get the team together, build enthusiasm, and brainstorm innovative ideas.",
    S: "Ensure everyone is supported, roles are steady, and workflows are sustainable.",
    C: "Analyze project parameters, gather specifications, and develop a structured plan.",
  },
  {
    question: "In team meetings with colleagues, you typically:",
    D: "Cut straight to the point and push for actionable decisions without lingering.",
    I: "Share stories, encourage participation, and keep the energy upbeat and vibrant.",
    S: "Listen carefully, validate teammates' feelings, and seek harmonious consensus.",
    C: "Ask clarifying questions, verify data points, and document decisions thoroughly.",
  },
  {
    question: "When dealing with unexpected changes or disruptions in the workplace, you:",
    D: "Adapt swiftly and take control to turn the disruption into a competitive advantage.",
    I: "Look at the silver lining and inspire others to embrace new opportunities.",
    S: "Prefer a gradual transition, checking that the team remains stable and secure.",
    C: "Evaluate how the change impacts existing procedures, quality, and standards.",
  },
  {
    question: "What motivates you most in your professional career?",
    D: "Overcoming tough challenges, achieving tangible victories, and having autonomy.",
    I: "Recognition, social influence, creative freedom, and inspiring others.",
    S: "Belonging to a loyal team, steady predictability, and helping colleagues succeed.",
    C: "Mastery of craft, solving complex problems with high precision, and technical excellence.",
  },
  {
    question: "Under high pressure or tight deadlines, people around you perceive you as:",
    D: "Direct, forceful, and impatient with anything slowing down results.",
    I: "Fast-talking, emotionally expressive, and occasionally prone to disorganization.",
    S: "Calm on the surface, hesitant to create conflict, but quietly carrying the load.",
    C: "Perfectionistic, analytical, and cautious about making hasty errors.",
  },
  {
    question: "When you disagree with a proposed plan of action, you are most likely to:",
    D: "State your objection firmly and challenge the plan directly in the moment.",
    I: "Persuade others with enthusiasm and propose a more exciting alternative.",
    S: "Express concerns gently in private so as not to disrupt team harmony.",
    C: "Present logical arguments, counter-evidence, and systematic risks.",
  },
  {
    question: "Your ideal daily work environment is:",
    D: "Fast-paced, results-focused, and offering freedom to make executive decisions.",
    I: "Dynamic, collaborative, communicative, and filled with variety and optimism.",
    S: "Predictable, supportive, friendly, and free from sudden unnecessary chaos.",
    C: "Quiet, structured, detail-oriented, and focused on quality and accuracy.",
  },
  {
    question: "When communicating essential information to others, you prefer:",
    D: "Bullet points with the bottom line: what needs to be done and by when.",
    I: "Engaging conversations, visual presentations, and motivating discussions.",
    S: "Thoughtful, step-by-step walkthroughs with patience and clear guidance.",
    C: "Comprehensive documentation, structured rationale, and factual clarity.",
  },
  {
    question: "When delegating or collaborating on a task, you expect:",
    D: "High ownership, zero excuses, and prompt delivery of results.",
    I: "Enthusiastic buy-in, creative collaboration, and active teamwork.",
    S: "Dependability, mutual loyalty, and steady follow-through on commitments.",
    C: "Flawless adherence to standards, rigor, and thorough attention to detail.",
  },
  {
    question: "If a coworker makes an honest mistake on a shared task, your instinctive response is:",
    D: "Fix the immediate issue quickly and focus on moving forward without delay.",
    I: "Reassure them with positivity and encourage them to try another angle.",
    S: "Offer patient support and help them rework it without making them feel bad.",
    C: "Investigate why the error happened and implement a safeguard to prevent recurrence.",
  },
  {
    question: "In making critical business decisions, you rely most heavily on:",
    D: "Your intuition and confidence in driving fast outcomes.",
    I: "People's sentiments, team morale, and innovative possibilities.",
    S: "Past proven experience, steady stability, and the impact on people.",
    C: "Hard data, objective analysis, and systematic risk evaluation.",
  },
  {
    question: "Which of the following feedback would satisfy you the most?",
    D: "\"You drove tremendous results and led us through a tough bottleneck.\"",
    I: "\"Your energy and leadership inspired the whole team to accomplish this.\"",
    S: "\"You are the most dependable, caring, and trustworthy teammate we have.\"",
    C: "\"Your analysis was impeccable, thorough, and completely error-free.\"",
  },
  {
    question: "When faced with routine, repetitive administrative tasks, you:",
    D: "Delegate them or find the fastest shortcut to get them off your plate.",
    I: "Find them boring and seek ways to make them lively or multitask.",
    S: "Carry them out steadily and reliably without complaint.",
    C: "Organize them systematically and ensure each is executed correctly.",
  },
  {
    question: "In a team conflict between two colleagues, you usually:",
    D: "Step in decisively to settle the dispute and refocus everyone on goals.",
    I: "Lighten the mood, bridge the gap with humor, and re-establish good vibes.",
    S: "Act as an empathetic mediator, listening patiently to both sides.",
    C: "Examine the objective facts and point out what protocol or logic dictates.",
  },
  {
    question: "Your primary strength as a teammate is:",
    D: "Decisiveness, drive, and the courage to take bold risks for growth.",
    I: "Charisma, persuasion, creativity, and motivating team morale.",
    S: "Patience, loyalty, reliability, and selfless teamwork.",
    C: "Critical thinking, technical rigor, quality control, and precision.",
  },
  {
    question: "Which workplace situation frustrates you the most?",
    D: "Hesitation, inefficiency, and people overanalyzing instead of taking action.",
    I: "Rigid bureaucracy, social isolation, and lack of creative enthusiasm.",
    S: "Sudden abrupt changes, volatile conflict, and high workplace friction.",
    C: "Sloppy mistakes, emotional reasoning, and lack of clear quality standards.",
  },
  {
    question: "When managing your daily schedule, you tend to:",
    D: "Focus aggressively on top-priority outcomes, adjusting on the fly.",
    I: "Prioritize meetings, creative conversations, and networking over rigid plans.",
    S: "Maintain a steady, well-paced routine and fulfill commitments consistently.",
    C: "Plan meticulously with structured checklists, calendars, and documentation.",
  },
  {
    question: "How do you typically approach professional relationships at work?",
    D: "Respect is earned through competence, results, and accountability.",
    I: "Friendship, genuine warmth, and enjoyable camaraderie are essential.",
    S: "Long-term trust, genuine kindness, and mutual support are paramount.",
    C: "Professional boundaries, mutual respect for expertise, and objective fairness.",
  },
  {
    question: "When presenting recommendations to executive leadership, you focus on:",
    D: "Strategic ROI, competitive advantage, and immediate impact on growth.",
    I: "The transformative vision, people's excitement, and future potential.",
    S: "Practical implementation feasibility, team impact, and sustainable pace.",
    C: "Comprehensive risk analysis, data validation, and exact methodology.",
  },
  {
    question: "At the end of a demanding work week, you feel most fulfilled when:",
    D: "You achieved difficult milestones and defeated complex obstacles.",
    I: "You had impactful conversations, motivated others, and shared great moments.",
    S: "The team worked cohesively in harmony and everyone was supported.",
    C: "Everything was executed to the highest quality standard with zero flaws.",
  },
];

export const DISC_PROFILES_INFO: Record<
  string,
  {
    name: string;
    headline: string;
    summary: string;
    strengths: string[];
    idealRoles: string[];
    workStyle: string;
  }
> = {
  D: {
    name: "Dominance (Director)",
    headline: "Results-Oriented & Decisive Commander",
    summary: "High drive, ambitious, direct communicator focused on winning, overcoming obstacles, and achieving concrete goals quickly.",
    strengths: ["Fast decision-making", "Crisis leadership", "Goal-focused drive", "Overcoming bottlenecks"],
    idealRoles: ["Operations Head", "General Manager", "Sales Director", "Startup Lead"],
    workStyle: "Pushes for swift execution, cuts through ambiguity, values autonomy.",
  },
  Di: {
    name: "Di (Pioneering Achiever)",
    headline: "Dynamic, Assertive & Persuasive Trailblazer",
    summary: "Combines high drive with infectious enthusiasm. Boldly launches initiatives, inspires others to join, and removes roadblocks.",
    strengths: ["Entrepreneurial initiative", "Inspiring persuasion", "High energy", "Bold problem-solving"],
    idealRoles: ["Business Development Head", "Product Lead", "Growth Marketing Lead"],
    workStyle: "High-paced, visionary, action-biased with strong interpersonal spark.",
  },
  iD: {
    name: "iD (Charismatic Driver)",
    headline: "Influential, Inspiring & Ambitious Catalyst",
    summary: "Energizing leader who uses charm, charisma, and ambition to mobilize teams and achieve stretch targets.",
    strengths: ["Charismatic leadership", "Negotiation", "Creative vision", "High adaptability"],
    idealRoles: ["Key Accounts Lead", "Client Relations Director", "Brand Champion"],
    workStyle: "Builds momentum through relationships, persuasive communication, and enthusiasm.",
  },
  I: {
    name: "Influence (Promoter)",
    headline: "Enthusiastic, Collaborative & Inspiring Communicator",
    summary: "Warm, expressive, and optimistic. Natural connector who excels at building morale, creative brainstorming, and partnerships.",
    strengths: ["People engagement", "Public speaking", "Fostering positivity", "Creative ideation"],
    idealRoles: ["HR Talent Acquisition", "Community Manager", "PR & Communications", "Brand Ambassador"],
    workStyle: "Open, expressive, highly collaborative, thrives on social interaction.",
  },
  iS: {
    name: "iS (Supportive Counselor)",
    headline: "Empathetic, Approachable & Harmonious Connector",
    summary: "Deeply caring, optimistic, and patient. Builds genuine trust, resolves friction gracefully, and supports team wellbeing.",
    strengths: ["Active listening", "Team cohesion", "Conflict resolution", "Warm customer empathy"],
    idealRoles: ["HR People & Culture", "Customer Success Lead", "Executive Assistant", "Counselor"],
    workStyle: "Nurturing, calm, collaborative, prioritizing trust and psychological safety.",
  },
  Si: {
    name: "Si (Team Harmonizer)",
    headline: "Loyal, Patient & Relationship-First Collaborator",
    summary: "Dependable and empathetic team anchor. Brings gentle encouragement, consistency, and dedication to shared success.",
    strengths: ["Patience with teammates", "Cross-team support", "Loyal execution", "Quiet diplomacy"],
    idealRoles: ["HR Operations", "Customer Support Manager", "Training & Onboarding Coordinator"],
    workStyle: "Patient, helpful, steady, thrives in harmonious and respectful environments.",
  },
  S: {
    name: "Steadiness (Supporter)",
    headline: "Reliable, Calm & Methodical Team Pillar",
    summary: "Even-tempered, patient, and deeply loyal. Excels at providing stability, following through on commitments, and supporting others.",
    strengths: ["Rock-solid reliability", "Process consistency", "Composed under stress", "Team loyalty"],
    idealRoles: ["Office Operations", "Administration Head", "Customer Service Lead", "Quality Coordinator"],
    workStyle: "Prefers predictable workflows, deep follow-through, low-drama collaboration.",
  },
  SC: {
    name: "SC (Careful Coordinator)",
    headline: "Deliberate, Thorough & Dependable Specialist",
    summary: "Combines calm steadiness with high standards. Methodical, calm, and consistently produces accurate, high-quality work.",
    strengths: ["Attention to detail", "Systematic execution", "Patience with complexity", "Zero-drama consistency"],
    idealRoles: ["Compliance Officer", "HR Operations & Payroll", "Logistics Coordinator"],
    workStyle: "Quiet, structured, thoughtful, delivers with meticulous reliability.",
  },
  CS: {
    name: "CS (Systematic Specialist)",
    headline: "Analytical, Thoughtful & Rigorous Problem Solver",
    summary: "Values precision and stability. Takes time to thoroughly verify information, structure workflows, and ensure flawless compliance.",
    strengths: ["In-depth analysis", "Reliable compliance", "Procedural excellence", "Risk mitigation"],
    idealRoles: ["Accountant / Financial Analyst", "Quality Assurance Engineer", "Data Specialist"],
    workStyle: "Methodical, deliberate, cautious, relies on clear rules and factual truth.",
  },
  C: {
    name: "Conscientiousness (Analyst)",
    headline: "Precise, Objective & Quality-Driven Perfectionist",
    summary: "Analytical thinker dedicated to accuracy, logical reasoning, and quality standards. Leaves no detail unchecked.",
    strengths: ["Deep technical rigor", "Objective analysis", "Root-cause diagnosis", "Error prevention"],
    idealRoles: ["Software Architect", "Auditor", "Technical Lead", "Financial Controller"],
    workStyle: "Independent, structured, data-driven, driven by high craftsmanship standards.",
  },
  CD: {
    name: "CD (Objective Architect)",
    headline: "Resolute, Critical & Efficiency-Focused Problem Solver",
    summary: "Combines high standards with strong ambition. Pragmatic, skeptical of assumptions, and relentlessly optimizes systems.",
    strengths: ["Process optimization", "Strategic problem-solving", "Uncompromising quality standards", "Efficiency focus"],
    idealRoles: ["Systems Analyst", "Technical Project Manager", "Operations Auditor", "Engineering Lead"],
    workStyle: "Direct, analytical, skeptical, insists on proof and high-efficiency outcomes.",
  },
  DC: {
    name: "DC (Driven Perfectionist)",
    headline: "Demanding, Strategic & High-Standard Overachiever",
    summary: "Ambitious driver who demands excellence from self and others. Blends bold leadership with rigorous analytical discipline.",
    strengths: ["Setting high performance bars", "Strategic execution", "Decisive technical leadership", "Competitive drive"],
    idealRoles: ["Chief Technology Officer", "VP of Operations", "Product Architect", "Managing Director"],
    workStyle: "Fast-paced yet rigorous, expects high standards and results, challenges mediocrity.",
  },
};

const DISC_NEIGHBOURS: Record<string, Record<string, boolean>> = {
  D: { I: true, C: true },
  I: { D: true, S: true },
  S: { I: true, C: true },
  C: { S: true, D: true },
};

const CODE_MAP: Record<string, string> = {
  DI: "Di",
  ID: "iD",
  IS: "iS",
  SI: "Si",
  SC: "SC",
  CS: "CS",
  CD: "CD",
  DC: "DC",
};

/**
 * Calculates D, I, S, C percentage scores and assigns 12-neighbor DISC profile code.
 */
export function calculateDiscResult(answers: Record<number, "D" | "I" | "S" | "C">) {
  const counts = { D: 0, I: 0, S: 0, C: 0 };
  const total = 20;

  for (let q = 1; q <= total; q++) {
    const selected = answers[q];
    if (selected && counts[selected] !== undefined) {
      counts[selected]++;
    }
  }

  const scores = {
    D: Math.round((counts.D / total) * 100),
    I: Math.round((counts.I / total) * 100),
    S: Math.round((counts.S / total) * 100),
    C: Math.round((counts.C / total) * 100),
  };

  const dims: { dim: "D" | "I" | "S" | "C"; count: number }[] = [
    { dim: "D", count: counts.D },
    { dim: "I", count: counts.I },
    { dim: "S", count: counts.S },
    { dim: "C", count: counts.C },
  ];

  dims.sort((a, b) => b.count - a.count);

  const primary = dims[0];
  const secondary = dims[1];
  let profileCode: string = primary.dim;

  // Secondary qualifies if count > 0, gap <= 2 (or 10%), and are circle neighbours
  if (
    secondary &&
    secondary.count > 0 &&
    primary.count - secondary.count <= 2 &&
    DISC_NEIGHBOURS[primary.dim]?.[secondary.dim]
  ) {
    const pair = `${primary.dim}${secondary.dim}`;
    profileCode = CODE_MAP[pair] || primary.dim;
  }

  const info = DISC_PROFILES_INFO[profileCode] || DISC_PROFILES_INFO[primary.dim] || DISC_PROFILES_INFO.S;

  return {
    counts,
    scores,
    profileCode,
    profileName: info.name,
    headline: info.headline,
    summary: info.summary,
    strengths: info.strengths,
    idealRoles: info.idealRoles,
    workStyle: info.workStyle,
  };
}
