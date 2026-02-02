import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), "dd/MM/yyyy", { locale: fr });
}

export function formatDateLong(dateStr: string): string {
  return format(parseISO(dateStr), "d MMMM yyyy", { locale: fr });
}

export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}
