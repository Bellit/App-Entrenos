const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const IconSelect = () => (
  <svg {...base}>
    <path d="M5 3l14 7-6 2-2 6z" fill="currentColor" fillOpacity={0.15} />
  </svg>
);
export const IconMove = () => (
  <svg {...base}>
    <path d="M4 19C8 18 12 10 18 6" />
    <path d="M14 5h5v5" />
  </svg>
);
export const IconDribble = () => (
  <svg {...base}>
    <path d="M3 18l2-3 2 2 2-3 2 2 2-3 2 2 1-2" />
    <path d="M14 7l5-1-1 5" />
    <path d="M16 13l3-7" />
  </svg>
);
export const IconPass = () => (
  <svg {...base}>
    <path d="M4 18L17 7" strokeDasharray="3 3" />
    <path d="M13 6h5v5" />
  </svg>
);
export const IconScreen = () => (
  <svg {...base}>
    <path d="M4 19L15 8" />
    <path d="M11 4l8 8" />
  </svg>
);
export const IconShot = () => (
  <svg {...base}>
    <circle cx="17" cy="6" r="3" />
    <path d="M4 20L13 10" strokeDasharray="2 2.5" />
    <path d="M6 21L14 12" strokeDasharray="2 2.5" />
  </svg>
);
export const IconPlay = () => (
  <svg {...base}>
    <path d="M7 4l13 8-13 8z" fill="currentColor" />
  </svg>
);
export const IconPause = () => (
  <svg {...base}>
    <path d="M7 4h3v16H7zM14 4h3v16h-3z" fill="currentColor" />
  </svg>
);
export const IconUndo = () => (
  <svg {...base}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 010 12h-3" />
  </svg>
);
export const IconRedo = () => (
  <svg {...base}>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H10a6 6 0 000 12h3" />
  </svg>
);
export const IconPlus = () => (
  <svg {...base}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconTrash = () => (
  <svg {...base}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);
export const IconCopy = () => (
  <svg {...base}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" />
  </svg>
);
export const IconVideo = () => (
  <svg {...base}>
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="M16 10l5-3v10l-5-3" />
  </svg>
);
export const IconImage = () => (
  <svg {...base}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="M21 16l-5-5-9 9" />
  </svg>
);
export const IconFolder = () => (
  <svg {...base}>
    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
  </svg>
);
export const IconDownload = () => (
  <svg {...base}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);
export const IconPrev = () => (
  <svg {...base}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const IconNext = () => (
  <svg {...base}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);
export const IconChevronDown = () => (
  <svg {...base} width={16} height={16}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const IconShare = () => (
  <svg {...base}>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M6 11H5a1 1 0 00-1 1v8a1 1 0 001 1h14a1 1 0 001-1v-8a1 1 0 00-1-1h-1" />
  </svg>
);
export const IconCloud = () => (
  <svg {...base}>
    <path d="M7 18a4.5 4.5 0 01-.6-8.96A6 6 0 0118 9.5a4 4 0 01-.5 8.5z" />
  </svg>
);
export const IconFile = () => (
  <svg {...base}>
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
    <path d="M14 3v5h5" />
  </svg>
);
export const IconMore = () => (
  <svg {...base}>
    <path d="M6 12h.01M12 12h.01M18 12h.01" strokeWidth={3} />
  </svg>
);
export const IconDuplicate = () => (
  <svg {...base}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M4 16V6a2 2 0 012-2h10M14 11v6M11 14h6" />
  </svg>
);
export const IconExpand = () => (
  <svg {...base}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </svg>
);
export const IconCompress = () => (
  <svg {...base}>
    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
  </svg>
);
export const IconHelp = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2" />
    <path d="M12 17h.01" strokeWidth={2.4} />
  </svg>
);
export const IconUpload = () => (
  <svg {...base}>
    <path d="M12 20V9M7 14l5-5 5 5M5 4h14" />
  </svg>
);
export const IconSearch = () => (
  <svg {...base} width={18} height={18}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </svg>
);
export const IconPanel = () => (
  <svg {...base}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M15 4v16M17.5 8.5h1M17.5 11.5h1" />
  </svg>
);
