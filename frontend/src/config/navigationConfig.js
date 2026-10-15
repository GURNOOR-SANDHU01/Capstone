import {
  BarChart3,
  BookOpen,
  TrendingUp,
  Bot,
  Stethoscope,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Video,
  Calendar,
  Bell,
  History,
  Shield,
  MessageSquare,
  Building2,
  FileText,
  Users
} from 'lucide-react';
import { ROLES } from '../constants/roles';

export const patientNavigation = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "companion", label: "AI Companion", icon: Bot },
  { id: "doctor-consultations", label: "Doctor Consultations", icon: Video },
  { id: "journal", label: "Journal & Diary", icon: BookOpen },
  { id: "insights", label: "Mood & Insights", icon: TrendingUp },
  { id: "appointments", label: "Appointments", icon: Calendar },
  { id: "reminders", label: "Reminders", icon: Bell },
  { id: "messages", label: "Care Team Messages", icon: MessageSquare },
  { id: "history", label: "Activity History", icon: History },
  { id: "privacy-masking", label: "Privacy & Masking", icon: Shield },
  { id: "profile", label: "Profile & Settings", icon: Settings }
];

export const doctorNavigation = [
  { id: "doctor-dashboard", label: "Clinical Dashboard", icon: BarChart3 },
  { id: "doctor-safety", label: "Doctor Safety Center", icon: ShieldAlert },
  { id: "doctor-patients", label: "Patient Roster", icon: Users },
  { id: "doctor-shared-journals", label: "Shared Journals", icon: BookOpen },
  { id: "doctor-consultations", label: "Doctor Consultations", icon: Video },
  { id: "doctor-appointments", label: "Appointments", icon: Calendar },
  { id: "doctor-reminders", label: "Care Instructions", icon: Bell },
  { id: "doctor-messaging", label: "Secure Messaging", icon: MessageSquare },
  { id: "profile", label: "Profile & Settings", icon: Settings }
];

export const adminNavigation = [
  { id: "admin-dashboard", label: "Admin Dashboard", icon: BarChart3 },
  { id: "admin-safety", label: "Admin Safety Center", icon: ShieldCheck },
  { id: "admin-doctors", label: "Doctor Management", icon: Stethoscope },
  { id: "admin-clinics", label: "Clinic Network", icon: Building2 },
  { id: "admin-audit", label: "Audit & Security Logs", icon: FileText },
  { id: "profile", label: "Profile & Settings", icon: Settings }
];

export const getNavigationForRole = (role) => {
  if (role === ROLES.ADMIN) return adminNavigation;
  if (role === ROLES.DOCTOR) return doctorNavigation;
  return patientNavigation;
};
