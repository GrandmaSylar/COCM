import { Input } from '../ui/input';
import { Label } from '../ui/label';

// Color Picker Component
export function ColorPicker({
  label,
  description,
  value,
  onChange,
  compact = false
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${compact ? '' : 'min-w-0'}`}>
      <Label className="text-xs font-medium">{label}</Label>
      {description && !compact && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <div className="flex gap-2 items-center">
        <div className="relative">
          <Input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-10 h-10 p-1 cursor-pointer border-2 rounded-lg"
          />
        </div>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${compact ? 'w-20' : 'flex-1'} h-10 font-mono text-xs`}
          placeholder="#000000"
        />
      </div>
    </div>
  );
}
