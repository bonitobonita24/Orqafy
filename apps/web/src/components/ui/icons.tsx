import type { JSX } from "react";
import { HugeiconsIcon, type HugeiconsIconProps } from "@hugeicons/react";
import {
  Add01Icon as _Add01Icon,
  AppleIcon as _AppleIcon,
  ArrowDown01Icon as _ArrowDown01Icon,
  ArrowDownRight01Icon as _ArrowDownRight01Icon,
  ArrowLeft01Icon as _ArrowLeft01Icon,
  ArrowRight01Icon as _ArrowRight01Icon,
  ArrowUp01Icon as _ArrowUp01Icon,
  ArrowUpDownIcon as _ArrowUpDownIcon,
  ArrowUpRight01Icon as _ArrowUpRight01Icon,
  AttachmentIcon as _AttachmentIcon,
  BankIcon as _BankIcon,
  BanknoteIcon as _BanknoteIcon,
  BookOpen01Icon as _BookOpen01Icon,
  BookOpenCheckIcon as _BookOpenCheckIcon,
  Briefcase01Icon as _Briefcase01Icon,
  Building03Icon as _Building03Icon,
  Calculator01Icon as _Calculator01Icon,
  CalendarClockIcon as _CalendarClockIcon,
  CalendarRangeIcon as _CalendarRangeIcon,
  Cancel01Icon as _Cancel01Icon,
  ChartColumnIcon as _ChartColumnIcon,
  ChartDecreaseIcon as _ChartDecreaseIcon,
  ChartIncreaseIcon as _ChartIncreaseIcon,
  CheckListIcon as _CheckListIcon,
  CheckmarkSquare03Icon as _CheckmarkSquare03Icon,
  CircleIcon as _CircleIcon,
  Clock01Icon as _Clock01Icon,
  Clock03Icon as _Clock03Icon,
  CreditCardIcon as _CreditCardIcon,
  DashboardSquare01Icon as _DashboardSquare01Icon,
  Delete02Icon as _Delete02Icon,
  DollarCircleIcon as _DollarCircleIcon,
  Download04Icon as _Download04Icon,
  DragDropVerticalIcon as _DragDropVerticalIcon,
  EyeIcon as _EyeIcon,
  EyeOffIcon as _EyeOffIcon,
  File01Icon as _File01Icon,
  Flag01Icon as _Flag01Icon,
  FolderLibraryIcon as _FolderLibraryIcon,
  FolderOpenIcon as _FolderOpenIcon,
  HandshakeIcon as _HandshakeIcon,
  Invoice01Icon as _Invoice01Icon,
  Invoice03Icon as _Invoice03Icon,
  KanbanIcon as _KanbanIcon,
  LifebuoyIcon as _LifebuoyIcon,
  Loading03Icon as _Loading03Icon,
  Mail01Icon as _Mail01Icon,
  Menu01Icon as _Menu01Icon,
  Message01Icon as _Message01Icon,
  MinusSignIcon as _MinusSignIcon,
  Moon02Icon as _Moon02Icon,
  MoreHorizontalIcon as _MoreHorizontalIcon,
  Notebook01Icon as _Notebook01Icon,
  Notification03Icon as _Notification03Icon,
  PackageDeliveredIcon as _PackageDeliveredIcon,
  PackageIcon as _PackageIcon,
  PackageSearchIcon as _PackageSearchIcon,
  PencilEdit02Icon as _PencilEdit02Icon,
  PrinterIcon as _PrinterIcon,
  RefreshIcon as _RefreshIcon,
  Search01Icon as _Search01Icon,
  SecurityCheckIcon as _SecurityCheckIcon,
  SecurityWarningIcon as _SecurityWarningIcon,
  Settings01Icon as _Settings01Icon,
  Settings02Icon as _Settings02Icon,
  ShoppingBag01Icon as _ShoppingBag01Icon,
  ShoppingCart01Icon as _ShoppingCart01Icon,
  SidebarLeft01Icon as _SidebarLeft01Icon,
  SmartPhone01Icon as _SmartPhone01Icon,
  SparklesIcon as _SparklesIcon,
  StarIcon as _StarIcon,
  Sun03Icon as _Sun03Icon,
  Tag01Icon as _Tag01Icon,
  TaskDaily01Icon as _TaskDaily01Icon,
  Tick02Icon as _Tick02Icon,
  Upload04Icon as _Upload04Icon,
  UserCheck01Icon as _UserCheck01Icon,
  UserGroupIcon as _UserGroupIcon,
  Wallet01Icon as _Wallet01Icon,
  Wrench01Icon as _Wrench01Icon,
} from "@hugeicons/core-free-icons";

/**
 * Icon adapter (Phase 4 — Tailwind v4 / shadcn-studio theme adoption).
 *
 * Lucide-shaped wrappers over hugeicons. Call sites keep importing lucide-named
 * components (`import { Check } from "@/components/ui/icons"`) and their JSX is
 * unchanged (`<Check className="size-4" />`). The ONLY semantic surface is the
 * lucide -> hugeicons name mapping below — one reviewable file.
 *
 * `strokeWidth` / `size` are pass-through; hugeicons defaults (size 24, stroke
 * 1.5) apply when unset. Tune globally here if the look needs it.
 */
export type IconProps = Omit<HugeiconsIconProps, "icon">;
export type IconType = (props: IconProps) => JSX.Element;

const makeIcon =
  (icon: HugeiconsIconProps["icon"]): IconType =>
  function Icon(props: IconProps) {
    return <HugeiconsIcon icon={icon} {...props} />;
  };

export const Apple = makeIcon(_AppleIcon);
export const ArrowDownRight = makeIcon(_ArrowDownRight01Icon);
export const ArrowRight = makeIcon(_ArrowRight01Icon);
export const ArrowRightIcon = makeIcon(_ArrowRight01Icon);
export const ArrowUpDown = makeIcon(_ArrowUpDownIcon);
export const ArrowUpRight = makeIcon(_ArrowUpRight01Icon);
export const Banknote = makeIcon(_BanknoteIcon);
export const BarChart3 = makeIcon(_ChartColumnIcon);
export const Bell = makeIcon(_Notification03Icon);
export const BookOpen = makeIcon(_BookOpen01Icon);
export const BookOpenCheck = makeIcon(_BookOpenCheckIcon);
export const Briefcase = makeIcon(_Briefcase01Icon);
export const Building2 = makeIcon(_Building03Icon);
export const Calculator = makeIcon(_Calculator01Icon);
export const CalendarClock = makeIcon(_CalendarClockIcon);
export const CalendarRange = makeIcon(_CalendarRangeIcon);
export const ChartColumnIncreasing = makeIcon(_ChartIncreaseIcon);
export const Check = makeIcon(_Tick02Icon);
export const CheckIcon = makeIcon(_Tick02Icon);
export const CheckSquare = makeIcon(_CheckmarkSquare03Icon);
export const ChevronDown = makeIcon(_ArrowDown01Icon);
export const ChevronDownIcon = makeIcon(_ArrowDown01Icon);
export const ChevronLeft = makeIcon(_ArrowLeft01Icon);
export const ChevronLeftIcon = makeIcon(_ArrowLeft01Icon);
export const ChevronRight = makeIcon(_ArrowRight01Icon);
export const ChevronRightIcon = makeIcon(_ArrowRight01Icon);
export const ChevronUp = makeIcon(_ArrowUp01Icon);
export const Circle = makeIcon(_CircleIcon);
export const CircleIcon = makeIcon(_CircleIcon);
export const ClipboardList = makeIcon(_TaskDaily01Icon);
export const Clock = makeIcon(_Clock01Icon);
export const Clock3 = makeIcon(_Clock03Icon);
export const CreditCard = makeIcon(_CreditCardIcon);
export const DollarSign = makeIcon(_DollarCircleIcon);
export const Download = makeIcon(_Download04Icon);
export const Eye = makeIcon(_EyeIcon);
export const EyeIcon = makeIcon(_EyeIcon);
export const EyeOff = makeIcon(_EyeOffIcon);
export const EyeOffIcon = makeIcon(_EyeOffIcon);
export const FileText = makeIcon(_File01Icon);
export const FolderKanban = makeIcon(_KanbanIcon);
export const FolderOpen = makeIcon(_FolderOpenIcon);
export const FolderTree = makeIcon(_FolderLibraryIcon);
export const GripVertical = makeIcon(_DragDropVerticalIcon);
export const HeartHandshake = makeIcon(_HandshakeIcon);
export const Landmark = makeIcon(_BankIcon);
export const LayoutDashboard = makeIcon(_DashboardSquare01Icon);
export const LifeBuoy = makeIcon(_LifebuoyIcon);
export const ListTodo = makeIcon(_CheckListIcon);
export const Loader2 = makeIcon(_Loading03Icon);
export const Mail = makeIcon(_Mail01Icon);
export const MenuIcon = makeIcon(_Menu01Icon);
export const MessageSquare = makeIcon(_Message01Icon);
export const Milestone = makeIcon(_Flag01Icon);
export const Minus = makeIcon(_MinusSignIcon);
export const Moon = makeIcon(_Moon02Icon);
export const MoreHorizontal = makeIcon(_MoreHorizontalIcon);
export const NotebookText = makeIcon(_Notebook01Icon);
export const Package = makeIcon(_PackageIcon);
export const PackageCheck = makeIcon(_PackageDeliveredIcon);
export const PackageSearch = makeIcon(_PackageSearchIcon);
export const PanelLeft = makeIcon(_SidebarLeft01Icon);
export const Paperclip = makeIcon(_AttachmentIcon);
export const Pencil = makeIcon(_PencilEdit02Icon);
export const Plus = makeIcon(_Add01Icon);
export const Printer = makeIcon(_PrinterIcon);
export const Receipt = makeIcon(_Invoice01Icon);
export const ReceiptText = makeIcon(_Invoice03Icon);
export const RefreshCw = makeIcon(_RefreshIcon);
export const Search = makeIcon(_Search01Icon);
export const Settings = makeIcon(_Settings01Icon);
export const Settings2 = makeIcon(_Settings02Icon);
export const ShieldAlert = makeIcon(_SecurityWarningIcon);
export const ShieldCheck = makeIcon(_SecurityCheckIcon);
export const ShoppingBag = makeIcon(_ShoppingBag01Icon);
export const ShoppingCart = makeIcon(_ShoppingCart01Icon);
export const Smartphone = makeIcon(_SmartPhone01Icon);
export const Sparkles = makeIcon(_SparklesIcon);
export const StarIcon = makeIcon(_StarIcon);
export const Sun = makeIcon(_Sun03Icon);
export const Tag = makeIcon(_Tag01Icon);
export const Trash2 = makeIcon(_Delete02Icon);
export const TrendingDown = makeIcon(_ChartDecreaseIcon);
export const TrendingUp = makeIcon(_ChartIncreaseIcon);
export const Upload = makeIcon(_Upload04Icon);
export const UserCheck = makeIcon(_UserCheck01Icon);
export const Users = makeIcon(_UserGroupIcon);
export const Wallet = makeIcon(_Wallet01Icon);
export const Wrench = makeIcon(_Wrench01Icon);
export const X = makeIcon(_Cancel01Icon);
export const XIcon = makeIcon(_Cancel01Icon);
