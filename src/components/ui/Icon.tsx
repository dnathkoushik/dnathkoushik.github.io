import {
  Activity,
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Award,
  Ban,
  Binary,
  BatteryFull,
  Bell,
  BookOpen,
  Bookmark,
  Boxes,
  Braces,
  Brain,
  Briefcase,
  Bug,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  CalendarX,
  ChartArea,
  ChartColumn,
  ChartLine,
  ChartNoAxesColumn,
  ChartPie,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleCheckBig,
  CircleDashed,
  CircleMinus,
  CirclePlus,
  CircleQuestionMark,
  CircleX,
  Clipboard,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Cloud,
  CloudOff,
  CloudDownload,
  CloudSun,
  CloudUpload,
  Code,
  Coffee,
  Command,
  Compass,
  Copy,
  CornerDownRight,
  Cpu,
  Crosshair,
  Database,
  Dot,
  Download,
  Dumbbell,
  Ellipsis,
  EllipsisVertical,
  ExternalLink,
  Eye,
  EyeOff,
  FaceAngry,
  FaceGrinning,
  FaceNeutral,
  FaceSlightlyFrowning,
  FaceSlightlySmiling,
  File,
  FileCode,
  FileText,
  Flame,
  Folder,
  FolderGit2,
  FolderOpen,
  Funnel,
  Gauge,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  Globe,
  GraduationCap,
  GripVertical,
  HardDrive,
  Hash,
  Heart,
  HeartPulse,
  Highlighter,
  Hourglass,
  House,
  Inbox,
  Info,
  KeyRound,
  Keyboard,
  Laptop,
  Layers,
  LayoutDashboard,
  Lightbulb,
  Link,
  ListFilter,
  ListTodo,
  LoaderCircle,
  Lock,
  LogIn,
  LockOpen,
  LogOut,
  Mail,
  MapPin,
  Medal,
  Menu,
  MessageSquare,
  Minus,
  Monitor,
  Moon,
  MoonStar,
  MoveRight,
  Notebook,
  Network,
  NotebookPen,
  Package,
  Palette,
  PanelLeft,
  PanelLeftClose,
  Paperclip,
  Pause,
  Plug,
  PenLine,
  Pencil,
  Percent,
  Phone,
  Pin,
  PinOff,
  Play,
  Plus,
  Puzzle,
  Quote,
  RefreshCw,
  Repeat,
  Rocket,
  RotateCcw,
  Save,
  Search,
  Send,
  Server,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  SquareCheck,
  SquarePen,
  Star,
  StickyNote,
  Sun,
  Sunrise,
  Sunset,
  Tag,
  Tags,
  Target,
  Terminal,
  ThumbsUp,
  Timer,
  Trash,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Undo2,
  Unplug,
  Upload,
  User,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * The curated icon set.
 *
 * Every icon in the product is resolved by string name through this map rather
 * than imported directly, so that configuration (`config/routes.ts`, the
 * `icon` field on a private Category record) can store a plain string. Keeping
 * the map explicit — instead of `import * as lucide` plus a dynamic lookup — is
 * what lets the bundler drop the other ~1,650 icons from the build.
 *
 * Names follow lucide v1, which removed a number of familiar v0 names
 * (`Home`, `Trash2`, `Code2`, `BarChart3`, `Filter`, `CheckCircle2`, `Loader2`,
 * `MoreHorizontal`). The v1 equivalents are the ones used here.
 *
 * Brand marks — GitHub, LinkedIn, X, LeetCode, Codeforces — are not in lucide
 * at all; they live in `components/common/BrandIcons`.
 */
const ICONS = {
  /* -- navigation & shell ------------------------------------------------ */
  House,
  User,
  Users,
  Layers,
  FolderGit2,
  Briefcase,
  Trophy,
  GitBranch,
  Mail,
  LayoutDashboard,
  ListTodo,
  CalendarDays,
  Target,
  Flame,
  ChartColumn,
  NotebookPen,
  ClipboardList,
  Activity,
  Settings,
  Menu,
  PanelLeft,
  PanelLeftClose,
  Command,
  Compass,
  LogOut,

  /* -- actions ----------------------------------------------------------- */
  Plus,
  Minus,
  Pencil,
  SquarePen,
  Trash,
  Copy,
  Check,
  X,
  Save,
  Download,
  Upload,
  Share2,
  ExternalLink,
  Link,
  Search,
  Funnel,
  ListFilter,
  ArrowUpDown,
  RefreshCw,
  RotateCcw,
  Undo2,
  Repeat,
  Play,
  Pause,
  Send,
  GripVertical,
  Ellipsis,
  EllipsisVertical,
  SlidersHorizontal,

  /* -- status ------------------------------------------------------------ */
  CircleCheckBig,
  CircleCheck,
  Circle,
  CircleDashed,
  CircleAlert,
  CircleX,
  CircleMinus,
  CirclePlus,
  CircleQuestionMark,
  TriangleAlert,
  Info,
  LoaderCircle,
  Ban,
  Shield,
  ShieldCheck,
  Lock,
  LockOpen,
  KeyRound,
  Eye,
  EyeOff,
  Bell,
  Dot,
  Square,
  SquareCheck,

  /* -- time & calendar --------------------------------------------------- */
  Clock,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarRange,
  CalendarPlus,
  CalendarX,
  Timer,
  Hourglass,
  Sunrise,
  Sunset,
  Sun,
  Moon,
  MoonStar,
  CloudSun,
  Monitor,

  /* -- analytics --------------------------------------------------------- */
  ChartLine,
  ChartPie,
  ChartArea,
  ChartNoAxesColumn,
  TrendingUp,
  TrendingDown,
  Gauge,
  Sparkles,
  Percent,
  Hash,
  Crosshair,

  /* -- journal, notes & files -------------------------------------------- */
  Notebook,
  BookOpen,
  Bookmark,
  FileText,
  File,
  FileCode,
  Folder,
  FolderOpen,
  StickyNote,
  Pin,
  PinOff,
  Tag,
  Tags,
  Quote,
  PenLine,
  Highlighter,
  Clipboard,
  ClipboardCheck,
  Archive,
  ArchiveRestore,
  Inbox,

  /* -- engineering & portfolio ------------------------------------------- */
  Code,
  Braces,
  Terminal,
  Database,
  Server,
  Cpu,
  Cloud,
  CloudDownload,
  CloudUpload,
  HardDrive,
  Globe,
  Package,
  Boxes,
  Puzzle,
  Wrench,
  Bug,
  GitCommitHorizontal,
  GitPullRequest,
  Star,
  GraduationCap,
  Award,
  Medal,
  Building2,
  MapPin,
  Phone,
  Paperclip,
  Rocket,
  Zap,
  Lightbulb,
  Palette,
  Laptop,
  Keyboard,

  /* -- arrows & chevrons ------------------------------------------------- */
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronsLeft,
  ChevronsRight,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  MoveRight,
  CornerDownRight,

  /* -- mood, energy & everything else ------------------------------------ */
  FaceGrinning,
  FaceSlightlySmiling,
  FaceNeutral,
  FaceSlightlyFrowning,
  FaceAngry,
  Heart,
  ThumbsUp,
  Coffee,
  Brain,
  Dumbbell,
  BatteryFull,
  MessageSquare,

  /* -- GitHub sync -------------------------------------------------------- */
  CloudOff,
  LogIn,
  Plug,
  Unplug,

  /* -- default category icons (see services/defaults.ts) ---------------- */
  Binary,
  Network,
  HeartPulse,
} satisfies Record<string, LucideIcon>

/** Every name `<Icon />` can render. Useful for the icon picker in Settings. */
export type IconName = keyof typeof ICONS

/** Sorted list of the curated names, for pickers and tests. */
// eslint-disable-next-line react-refresh/only-export-components
export const ICON_NAMES = Object.keys(ICONS).sort() as IconName[]

/** True when `name` resolves to a real glyph rather than the fallback dot. */
// eslint-disable-next-line react-refresh/only-export-components
export function hasIcon(name: string | null | undefined): name is IconName {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(ICONS, name)
}

const warnedNames = new Set<string>()

function warnOnce(name: string) {
  if (!import.meta.env.DEV || warnedNames.has(name)) return
  warnedNames.add(name)
  console.warn(
    `[Icon] "${name}" is not in the curated icon set — rendering a neutral dot. ` +
      'Add it to src/components/ui/Icon.tsx if it is a valid lucide v1 name.',
  )
}

export interface IconProps {
  /** A key of the curated set. Unknown names degrade to a neutral dot. */
  name: string
  /** Edge length in px. Defaults to 16. */
  size?: number
  className?: string
  /** Line weight. Defaults to lucide's 2, easing to 1.75 at display sizes. */
  strokeWidth?: number
  /**
   * Supplying a title promotes the icon from decoration to content: it gains
   * `role="img"` and an accessible name. Leave it off whenever adjacent text
   * already says the same thing — otherwise screen readers hear it twice.
   */
  title?: string
}

/**
 * Renders one icon from the curated set.
 *
 * Icons are `aria-hidden` by default because nearly all of them sit beside a
 * visible label. An unknown name never throws: it renders a small neutral dot,
 * which keeps a mistyped category icon from taking down the page.
 */
export function Icon({ name, size = 16, className, strokeWidth, title }: IconProps) {
  const ariaProps = title
    ? ({ role: 'img', 'aria-label': title } as const)
    : ({ 'aria-hidden': true } as const)

  if (!hasIcon(name)) {
    warnOnce(name)
    return (
      <span
        className={cn('inline-flex shrink-0 items-center justify-center', className)}
        style={{ width: size, height: size }}
        {...ariaProps}
      >
        <span className="block size-1.5 rounded-full bg-current opacity-45" />
      </span>
    )
  }

  const Glyph = ICONS[name]

  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth ?? (size >= 28 ? 1.75 : 2)}
      className={cn('shrink-0', className)}
      focusable="false"
      {...ariaProps}
    />
  )
}
