// ─────────────────────────────────────────────────────────────
//  PORTFOLIO CONTENT
//  Everything shown on the hero, the three billboards and the
//  detail panels comes from this file. Edit it, save, done.
// ─────────────────────────────────────────────────────────────

export const profile = {
  name: 'Lakshya Daga',
  shortName: 'LAKSHYA',
  role: 'Web Developer · Designer · Web-Slinger',
  tagline: 'Building interactive web experiences, one thwip at a time.',
  earth: 'EARTH-1610',
  city: 'NEO-SHIBUYA',
  cityEarth: 'EARTH-928B',
};

export const about = {
  id: 'about',
  index: '01',
  title: 'ABOUT ME',
  kicker: 'Origin story',
  accent: '#ff2d6f',
  accent2: '#2de2ff',
  headline: "Okay, let's take it from the top.",
  paragraphs: [
    "My name is Lakshya Daga and I'm currently a first-year student at VIT Vellore.",
    'I love solving real-time problems, especially the ones that help achieve the Sustainable Development Goals.',
  ],
  facts: [
    { label: 'Studying at', value: 'VIT Vellore' },
    { label: 'Year', value: 'First year' },
    { label: 'Driven by', value: 'Sustainable impact' },
  ],
  skills: ['HTML', 'CSS', 'JavaScript', 'jQuery', 'Next.js', 'NextAuth', 'Firebase', 'Three.js'],
  ticker: 'WHO IS BEHIND THE MASK? ✦ SCROLL TO MEET THE DEVELOPER ✦ ',
};

export const projects = {
  id: 'projects',
  index: '02',
  title: 'PROJECTS',
  kicker: 'Missions completed',
  accent: '#ffb21a',
  accent2: '#ff3c3c',
  headline: 'My top 3 builds.',
  items: [
    {
      name: 'Frill & Flair',
      status: 'In progress',
      tags: ['HTML', 'CSS', 'JavaScript'],
      blurb: "A landing page for my mother's boutique of handcrafted sarees, suits and lehengas, with an elegant, animated multi-page design.",
      link: '#',
    },
    {
      name: 'Facebook Clone',
      status: 'Completed',
      tags: ['Next.js', 'NextAuth', 'Firebase'],
      blurb: 'A Facebook-style social feed with secure sign-in through NextAuth and posts stored in real time with Firebase.',
      link: '#',
    },
    {
      name: 'Simon Game',
      status: 'Completed',
      tags: ['HTML', 'CSS', 'JavaScript'],
      blurb: 'The classic memory game: follow a growing sequence of colours and sounds, with levels that get harder each round.',
      link: '#',
    },
  ],
  ticker: 'CASE FILES ✦ MISSIONS LOGGED ✦ CLICK THE BILLBOARD FOR DETAILS ✦ ',
};

export const goals = {
  id: 'goals',
  index: '03',
  title: 'FUTURE GOALS',
  kicker: 'Next dimension',
  accent: '#8a5bff',
  accent2: '#2dffb0',
  headline: 'Where I am swinging next.',
  // `title` is the short line on the billboard; `goal` is the full sentence on the panel.
  items: [
    {
      when: 'Short term',
      title: 'Tech for the SDGs',
      goal: 'I aim to work on innovative tech initiatives that support national Sustainable Development Goals.',
      progress: 0.65,
    },
    {
      when: 'Mid term',
      title: 'A high-impact engineering role',
      goal: 'I aspire to secure a high-impact engineering role at a leading company to learn how enterprise systems scale.',
      progress: 0.35,
    },
    {
      when: 'Long term',
      title: 'Launch my own startup',
      goal: 'My ultimate goal is to launch my own startup focused on community-driven innovation and social empowerment.',
      progress: 0.12,
    },
  ],
  quote: 'Anyone can wear the mask.',
  ticker: 'WITH GREAT POWER COMES GREAT RESPONSIBILITY ✦ THE NEXT CHAPTER LOADS SOON ✦ ',
};

export const contact = {
  email: 'lakshya.daga2026@vitstudent.ac.in', // clicking it opens Gmail compose, pre-addressed
  links: [
    { label: 'GitHub', url: 'https://github.com/Lakshya-0601' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/lakshya-daga-384207443/' },
    { label: 'Instagram', url: 'https://www.instagram.com/lakshya_tf/' },
  ],
};

export const sections = [about, projects, goals];
