import type { Platform } from '@/types';

export const KanbanIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="1.5" y="2.5" width="3.5" height="11" rx="1" />
    <rect x="6.25" y="2.5" width="3.5" height="8" rx="1" />
    <rect x="11" y="2.5" width="3.5" height="6" rx="1" />
  </svg>
);

export const ListIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M5 4h9M5 8h9M5 12h9" />
    <circle cx="2" cy="4" r="1" />
    <circle cx="2" cy="8" r="1" />
    <circle cx="2" cy="12" r="1" />
  </svg>
);

export const DashboardIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="2" y="2" width="5" height="6" rx="1" />
    <rect x="9" y="2" width="5" height="4" rx="1" />
    <rect x="2" y="10" width="5" height="4" rx="1" />
    <rect x="9" y="8" width="5" height="6" rx="1" />
  </svg>
);

export const InboxIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M1.5 8h3l1.5 2.5h4L11.5 8h3" />
    <path d="M2 8l1.5-5h9L14 8v4.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
  </svg>
);

export const TasksIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M5.5 8l2 2 3.5-4" />
    <rect x="2" y="2" width="12" height="12" rx="2.5" />
  </svg>
);

export const TemplateIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="2.5" y="1.75" width="11" height="12.5" rx="2" />
    <path d="M5 5h6M5 8h6M5 11h3.5" />
  </svg>
);

export const GoalIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="6" />
    <circle cx="8" cy="8" r="3.25" />
    <circle cx="8" cy="8" r="0.75" fill="currentColor" stroke="none" />
  </svg>
);

export const SprintIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
    <path d="M3 2v12" />
    <path d="M3 2.5h8.5l-1.5 2.5 1.5 2.5H3" />
  </svg>
);

export const RoadmapIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M2 12.5c2 0 2-3 4-3s2 3 4 3 2-6 4-6" />
    <circle cx="2" cy="12.5" r="0.6" fill="currentColor" stroke="none" />
    <circle cx="14" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
  </svg>
);

export const StarOutlineIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6 4.2 13.6l.7-4.3L1.8 6.3l4.3-.6z" />
  </svg>
);

export const SnoozeIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13.5 9.5A6 6 0 1 1 6.5 2.5a4.8 4.8 0 0 0 7 7z" />
    <path d="M9.5 3.5h2.5L9.5 6h2.5" strokeWidth="1.2" />
  </svg>
);

export const ArchiveIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="2.5" width="12" height="3" rx="1" />
    <path d="M3 5.5v7a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-7" />
    <path d="M6.5 8.5h3" strokeLinecap="round" />
  </svg>
);

export const SearchIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="6.5" cy="6.5" r="4.5" />
    <path d="m10 10 3 3" />
  </svg>
);

export const PlusIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M8 2v12M2 8h12" />
  </svg>
);

export const EditIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M11 2l3 3-8 8H3v-3L11 2z" />
  </svg>
);

export const TrashIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M3 4h10M6 4V3h4v1M5 4v8h6V4H5z" />
  </svg>
);

export const CloseIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 3l10 10M13 3 3 13" />
  </svg>
);

export const ColumnIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="1" y="2" width="4" height="12" rx="1" />
    <rect x="9" y="2" width="4" height="12" rx="1" />
    <path d="M14 5h2M14 8h2M14 11h2" />
  </svg>
);

export const McpIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M8 1.5v3M8 11.5v3M14.5 8h-3M4.5 8h-3M12.6 3.4 10.5 5.5M5.5 10.5 3.4 12.6M12.6 12.6 10.5 10.5M5.5 5.5 3.4 3.4" />
    <circle cx="8" cy="8" r="2.2" />
  </svg>
);

export const FolderIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M2 4a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
  </svg>
);

export const LogoutIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3M10 11l3-3-3-3M13 8H6" />
  </svg>
);

export const CalIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="2" y="3" width="12" height="11" rx="1.5" />
    <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
  </svg>
);

export const ClientsIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="6" cy="5.5" r="2.5" />
    <path d="M1.5 14c.5-2.5 2.3-4 4.5-4s4 1.5 4.5 4" />
    <circle cx="12" cy="6" r="1.8" />
    <path d="M11 12c.5-1.5 1.5-2.3 3-2.3 1 0 1.5 1 1.5 2.3" />
  </svg>
);

export const AnalyticsIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M2 13V3M2 13h12" />
    <path d="M5 10v2M8 7v5M11 5v7" />
  </svg>
);

export const IntegrationsIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1.5" y="6" width="5" height="4" rx="1" />
    <rect x="9.5" y="6" width="5" height="4" rx="1" />
    <path d="M6.5 8h3" />
    <circle cx="4" cy="3" r="1.2" />
    <circle cx="12" cy="13" r="1.2" />
    <path d="M4 4.2v1.8M12 11.8V10" />
  </svg>
);

export const SettingsIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="2.1" />
    <path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8 3.4 3.4" />
  </svg>
);

export const CalendarIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="2" y="3.5" width="12" height="10" rx="1.5" />
    <path d="M2 6.5h12M5 2v3M11 2v3" />
    <circle cx="8" cy="10" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

export const EmailIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
    <path d="M2.5 4.5l5.5 4 5.5-4" />
  </svg>
);

export const VideoIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7">
    <rect x="1.5" y="4" width="9" height="8" rx="1.5" />
    <path d="m10.5 7.5 3.5-2v5l-3.5-2z" />
  </svg>
);

export const ExternalIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M9 2h5v5M14 2 7 9M11.5 9v3.5a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1H7" />
  </svg>
);

export const PeopleIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="5.5" cy="5.5" r="2" />
    <path d="M1.5 13c.5-2 2-3 4-3s3.5 1 4 3" />
    <circle cx="11" cy="6" r="1.5" />
    <path d="M10 12c.4-1 1.3-1.6 2.5-1.6 1 0 1.5.7 1.5 1.6" />
  </svg>
);

export const SubIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M5.5 8l2 2 3.5-4" />
    <rect x="2" y="2" width="12" height="12" rx="2.5" />
  </svg>
);

export const ChatIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M2 3h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-3 2V4a1 1 0 0 1 1-1z" />
  </svg>
);

export const LinkIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M9 5L5 9a2 2 0 0 0 3 3l5-5a3.5 3.5 0 0 0-5-5L3 7" />
  </svg>
);

export const TextIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M3 4h10M3 8h10M3 12h6" />
  </svg>
);

export const CheckIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M3 8l3.5 3.5L13 4" />
  </svg>
);

const WppSvg = `<svg viewBox="0 0 24 24" fill="currentColor" width="9" height="9"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;

const InstaSvg = `<svg viewBox="0 0 24 24" fill="currentColor" width="9" height="9"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>`;

const MsgSvg = `<svg viewBox="0 0 24 24" fill="currentColor" width="9" height="9"><path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.092.3 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.259L19.752 8l-6.561 6.963z"/></svg>`;

export const PLAT_LABEL: Record<Platform, string> = {
  wpp: 'WhatsApp', insta: 'Instagram', msg: 'Messenger'
};
export const PLAT_CLASS: Record<Platform, string> = {
  wpp: 'bwpp', insta: 'binsta', msg: 'bmsg'
};
export const PLAT_ICON_HTML: Record<Platform, string> = {
  wpp: WppSvg, insta: InstaSvg, msg: MsgSvg
};

export const PLAT_LIST: Platform[] = ['wpp', 'insta', 'msg'];

export const PRIO_LABEL: Record<'high' | 'med' | 'low', string> = {
  high: 'Alta', med: 'Média', low: 'Baixa'
};
export const PRIO_CLASS: Record<'high' | 'med' | 'low', string> = {
  high: 'bhigh', med: 'bmed', low: 'blow'
};
