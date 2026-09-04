import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export function SliderField({
  label,
  display,
  min,
  max,
  step,
  value,
  onValueChange,
}: {
  label: string;
  display: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onValueChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="font-medium text-muted">{label}</span>
        <span className="font-mono tabular-nums text-subtle">{display}</span>
      </span>
      <SliderPrimitive.Root
        className="relative flex h-6 w-full touch-none items-center select-none"
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onValueChange(v[0] ?? value)}
      >
        <SliderPrimitive.Track className="relative h-1 grow rounded-full bg-surface">
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-accent" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className={cn(
            "block size-3.5 rounded-full bg-fg shadow-border",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
          )}
          aria-label={label}
        />
      </SliderPrimitive.Root>
    </label>
  );
}
