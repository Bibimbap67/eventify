import React from "react";
import {
  Menu, X, Calendar, MapPin, Ticket, Award, User, Check, Search, Bell, Mic, Smartphone,
  Clock, MessageSquare, TriangleAlert, Info, Pencil, Printer, Users, Star, ArrowUpRight,
  ArrowRight, ArrowLeft, ArrowDown, ArrowUp, ChevronDown, Volume2, VolumeX, CircleCheck,
  QrCode, LogOut, UserPlus, LayoutDashboard, ShieldCheck,
  LogIn, Pause, Play, ScanLine, GraduationCap, ClipboardList, Cpu, BookOpen, Briefcase, Wrench,
  Trophy, Heart, CalendarCheck, Armchair, Tags,
  CalendarDays, ClipboardCheck, CalendarClock, Megaphone, ChartColumn, Plus, Download, Undo2,
  CircleAlert, Hourglass, UserCheck, Activity, Sun, Sunrise, Moon, Trash2, Inbox, Send,
  Camera, CameraOff, ImageUp, Eye, EyeOff,
  Settings, PanelLeftClose, PanelLeftOpen, RotateCw, KeyRound, Ban, ExternalLink, History, ChevronLeft, ChevronRight,
} from "lucide-react";

// Old hand-drawn names are kept so every existing caller still works.
const ICONS = {
  menu: Menu,
  close: X,
  calendar: Calendar,
  pin: MapPin,
  ticket: Ticket,
  certificate: Award,
  user: User,
  check: Check,
  search: Search,
  bell: Bell,
  speaker: Mic,
  phone: Smartphone,
  clock: Clock,
  message: MessageSquare,
  alert: TriangleAlert,
  info: Info,
  edit: Pencil,
  print: Printer,
  users: Users,
  star: Star,
  arrow: ArrowUpRight,
  "arrow-right": ArrowRight,
  "arrow-left": ArrowLeft,
  "arrow-down": ArrowDown,
  "arrow-up": ArrowUp,
  caret: ChevronDown,
  "check-circle": CircleCheck,
  sound: Volume2,
  mute: VolumeX,
  qr: QrCode,
  logout: LogOut,
  "user-plus": UserPlus,
  dashboard: LayoutDashboard,
  shield: ShieldCheck,
  // Landing page
  login: LogIn,
  pause: Pause,
  play: Play,
  scan: ScanLine,
  graduation: GraduationCap,
  clipboard: ClipboardList,
  cpu: Cpu,
  book: BookOpen,
  briefcase: Briefcase,
  wrench: Wrench,
  trophy: Trophy,
  heart: Heart,
  "calendar-check": CalendarCheck,
  armchair: Armchair,
  tags: Tags,
  // Manager workspace
  "calendar-days": CalendarDays,
  "clipboard-check": ClipboardCheck,
  schedule: CalendarClock,
  megaphone: Megaphone,
  chart: ChartColumn,
  plus: Plus,
  download: Download,
  undo: Undo2,
  "alert-circle": CircleAlert,
  hourglass: Hourglass,
  "user-check": UserCheck,
  activity: Activity,
  sun: Sun,
  sunrise: Sunrise,
  moon: Moon,
  trash: Trash2,
  inbox: Inbox,
  send: Send,
  // Check-in desk
  camera: Camera,
  "camera-off": CameraOff,
  image: ImageUp,
  // Password fields
  eye: Eye,
  "eye-off": EyeOff,
  // Admin area
  settings: Settings,
  "panel-close": PanelLeftClose,
  "panel-open": PanelLeftOpen,
  refresh: RotateCw,
  key: KeyRound,
  ban: Ban,
  external: ExternalLink,
  history: History,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
};

// One size scale: 16 / 20 / 24.
function snapSize(size) {
  if (size <= 17) return 16;
  if (size <= 21) return 20;
  return 24;
}

export default function Icon({ name, size = 18, label, className = "" }) {
  const Glyph = ICONS[name];
  if (!Glyph) return null;

  return (
    <Glyph
      className={`ui-icon${className ? ` ${className}` : ""}`}
      size={snapSize(size)}
      strokeWidth={2.25}
      fill={name === "star" ? "currentColor" : "none"}
      aria-hidden={label ? undefined : "true"}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable="false"
    />
  );
}
