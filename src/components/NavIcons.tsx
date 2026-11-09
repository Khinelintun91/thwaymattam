type NavId = 'home' | 'add' | 'history' | 'charts' | 'more';

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function NavIcon({ id }: { id: NavId }) {
  switch (id) {
    case 'home':
      return (
        <Icon>
          <path d="M4 11.5 12 4l8 7.5" />
          <path d="M5.5 10.5V20a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1v-9.5" />
        </Icon>
      );
    case 'add':
      return (
        <Icon>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </Icon>
      );
    case 'history':
      return (
        <Icon>
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4.5A2.5 2.5 0 0 1 11.5 2h1A2.5 2.5 0 0 1 15 4.5" />
          <path d="M9 11h6" />
          <path d="M9 15h4" />
        </Icon>
      );
    case 'charts':
      return (
        <Icon>
          <path d="M4 20V11" />
          <path d="M10 20V5" />
          <path d="M16 20v-8" />
          <path d="M2.5 20h19" />
        </Icon>
      );
    case 'more':
      return (
        <Icon>
          <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
        </Icon>
      );
  }
}
