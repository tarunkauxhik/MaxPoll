"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Home · Spaces · Create(+) · Profile.
 *
 * One component, one DOM tree: the bottom bar becomes a left rail at >=768px
 * through a media query in globals.css. No JS breakpoint, no resize listener,
 * no duplicated markup to drift apart.
 *
 * Icons are inline SVG rather than the prototype's `◆ ◇ ○` text glyphs, which
 * are font-dependent and render differently on every Android.
 */

const ICON = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function HomeIcon() {
  return (
    <svg {...ICON} aria-hidden="true">
      <path d="M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5v-6.5H10V21H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function SpacesIcon() {
  return (
    <svg {...ICON} aria-hidden="true">
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg {...ICON} strokeWidth={2.25} aria-hidden="true">
      <path d="M12 5.5v13M5.5 12h13" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg {...ICON} aria-hidden="true">
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

const ITEMS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/spaces", label: "Spaces", Icon: SpacesIcon },
  { href: "/create", label: "Create", Icon: PlusIcon, create: true },
  { href: "/profile", label: "Profile", Icon: ProfileIcon },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Primary">
      {ITEMS.map(({ href, label, Icon, ...rest }) => {
        const current = href === "/" ? pathname === "/" : pathname.startsWith(href);
        const create = "create" in rest;
        return (
          <Link
            key={href}
            href={href}
            className={create ? "create" : undefined}
            aria-current={current ? "page" : undefined}
            aria-label={label}
          >
            <span className="ic">
              <Icon />
            </span>
            {!create && label}
          </Link>
        );
      })}
    </nav>
  );
}
