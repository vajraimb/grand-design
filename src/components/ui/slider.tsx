import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (v: number) => void;
  label: string;
  display: string;
  className?: string;
};

export function SliderField({
  value,
  min,
  max,
  step = 0.01,
  onValueChange,
  label,
  display,
  className,
}: Props) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium tracking-wide text-muted uppercase">
          {label}
        </span>
        <span className="font-mono text-xs tabular-nums text-fg">{display}</span>
      </span>
      <SliderPrimitive.Root
        className="relative flex h-5 w-full touch-none items-center select-none"
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onValueChange(v[0] ?? value)}
      >
        <SliderPrimitive.Track className="relative h-px w-full grow rounded-full bg-border">
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-fg" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block size-3 rounded-full bg-fg shadow-border outline-none transition-[box-shadow,transform] duration-(--motion-quick) ease-(--ease-out) hover:scale-110 focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-fg)_25%,transparent)]" />
      </SliderPrimitive.Root>
    </label>
  );
}
