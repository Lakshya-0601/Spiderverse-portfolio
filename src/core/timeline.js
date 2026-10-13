// Scroll choreography. All values are normalised scroll progress (0 → 1).
export const T = {
  swingStart: 0.035, // Spider-Man swings in on a web…
  swingEnd: 0.15, //   …and through the portal membrane
  pushStart: 0.13, // camera dives into the portal
  swap: 0.27, // dimension jump → the city
  fallEnd: 0.42, // superhero landing
  reveal: [0.475, 0.5], // over-the-shoulder skyline reveal (hold)
  about: [0.545, 0.625],
  projects: [0.665, 0.745],
  goals: [0.785, 0.865],
  outro: [0.93, 1],
};

// Nav items: `p` is where clicking scrolls to, `from` is where the item becomes active.
export const STOPS = [
  { id: 'portal', label: 'Portal', p: 0, from: 0 },
  { id: 'drop', label: 'The Drop', p: 0.49, from: T.swap },
  { id: 'about', label: 'About', p: (T.about[0] + T.about[1]) / 2, from: T.about[0] - 0.03 },
  { id: 'projects', label: 'Projects', p: (T.projects[0] + T.projects[1]) / 2, from: T.projects[0] - 0.03 },
  { id: 'goals', label: 'Goals', p: (T.goals[0] + T.goals[1]) / 2, from: T.goals[0] - 0.03 },
  { id: 'contact', label: 'Contact', p: 0.98, from: T.outro[0] - 0.03 },
];

// Which panel (if any) should be visible at progress p.
export function activeSection(p) {
  const pad = 0.02;
  if (p > T.about[0] - pad && p < T.about[1] + pad) return 'about';
  if (p > T.projects[0] - pad && p < T.projects[1] + pad) return 'projects';
  if (p > T.goals[0] - pad && p < T.goals[1] + pad) return 'goals';
  if (p > T.outro[0] - pad) return 'contact';
  return null;
}
