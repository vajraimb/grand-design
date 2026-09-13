import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

type Props = {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
};

export function SwitchField({ checked, onCheckedChange, label }: Props) {
  return (
    <label className="flex h-8 items-center justify-between gap-3">
      <span className="text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </span>
      <SwitchPrimitive.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={cn(
          "relative h-5 w-8 shrink-0 rounded-full border border-border transition-colors duration-(--motion-quick) ease-(--ease-out)",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-fg)_25%,transparent)]",
          checked ? "bg-fg" : "bg-surface",
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "block size-3.5 translate-x-0.5 rounded-full transition-transform duration-(--motion-quick) ease-(--ease-out)",
            checked ? "translate-x-3.5 bg-bg" : "bg-muted",
          )}
        />
      </SwitchPrimitive.Root>
    </label>
  );
}
