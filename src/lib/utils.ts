import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseDateLocal(dateStr: string | null | undefined): Date | null {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    return null;
}

export function differenceInDays(dateLeft: Date, dateRight: Date): number {
    const diffTime = Math.abs(dateLeft.getTime() - dateRight.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
}
