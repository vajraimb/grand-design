import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function SwitchField({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <label className="flex h-11 items-center justify-between gap-3">
      <span className="text-sm text-fg">{label}</span>
      <SwitchPrimitive.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full bg-surface shadow-border",
          "data-[state=checked]:bg-accent",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "block size-5 translate-x-0.5 rounded-full bg-fg transition-transform duration-(--motion-quick) ease-(--ease-out)",
            "data-[state=checked]:translate-x-4 data-[state=checked]:bg-accent-fg",
          )}
        />
      </SwitchPrimitive.Root>
    </label>
  );
}
