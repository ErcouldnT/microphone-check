/**
 * The app's icon vocabulary.
 *
 * Everything imports icons from here rather than reaching into
 * lucide-react-native directly, so the same concept always gets the same glyph
 * and swapping one out is a single edit.
 */
export {
  // Navigation & structure
  CalendarDays as CalendarIcon,
  CalendarClock as ScheduleIcon,
  LayoutGrid as MonthIcon,
  Columns3 as WeekIcon,
  Clock as DayIcon,
  ChartNoAxesColumn as StatsIcon,
  Settings as SettingsIcon,
  Sparkles as TodayIcon,

  // Actions
  Plus as AddIcon,
  X as CloseIcon,
  Check as CheckIcon,
  Trash2 as DeleteIcon,
  Pencil as EditIcon,
  Save as SaveIcon,
  Copy as CopyIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  RefreshCw as SyncIcon,
  LogOut as LeaveIcon,
  RotateCcw as UndoIcon,

  // Chevrons
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  ChevronDown as ExpandIcon,
  ChevronUp as CollapseIcon,

  // People & relationship
  User as MeIcon,
  Users as PartnersIcon,
  Heart as HeartIcon,
  HeartHandshake as TogetherIcon,
  UserRound as PersonIcon,

  // Content
  StickyNote as NoteIcon,
  Mic as MicIcon,
  Star as MilestoneIcon,
  Plane as TripIcon,
  PartyPopper as CelebrateIcon,
  Gift as GiftIcon,
  RotateCcwClock as PastIcon,
  Eye as ShowIcon,
  EyeOff as HideIcon,
  MapPin as PlaceIcon,

  // Status & feedback
  Bell as NotificationIcon,
  BellRing as ReminderIcon,
  CircleCheck as CompletedIcon,
  Circle as PendingIcon,
  TriangleAlert as WarningIcon,
  Info as InfoIcon,
  Wifi as OnlineIcon,
  WifiOff as OfflineIcon,
  Palette as ColorIcon,
} from 'lucide-react-native';

/** Icon sizes used across the app, so scale stays consistent. */
export const IconSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  hero: 32,
} as const;

/** Palette shared by icons and their surrounding chrome. */
export const IconColor = {
  cyan: '#00FFFF',
  pink: '#FF007F',
  purple: '#A855F7',
  yellow: '#FACC15',
  green: '#22C55E',
  red: '#EF4444',
  muted: '#8A8A94',
  faint: '#4B5563',
  white: '#FFFFFF',
} as const;
