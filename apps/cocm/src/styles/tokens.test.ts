// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { neutrals } from '@cms/shared/design';

// globals.css carries the first-paint values of the colour tokens. They must stay
// equal to the shared design tokens (@cms/shared/design) that the Expo app and
// the admin apps use, so the neutrals look the same everywhere.
const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

function variables(selector: RegExp): Record<string, string> {
  const block = selector.exec(css)?.[1];
  if (!block) throw new Error(`No block found for ${selector}`);
  const found: Record<string, string> = {};
  for (const match of block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/gi)) found[match[1]] = match[2].trim().toLowerCase();
  return found;
}

const modes = [
  { name: 'light', selector: /:root\s*\{([^}]*)\}/, tokens: neutrals.light },
  { name: 'dark', selector: /\.dark\s*\{([^}]*)\}/, tokens: neutrals.dark },
] as const;

describe.each(modes)('$name neutrals', ({ selector, tokens }) => {
  const vars = variables(selector);
  const expected: Record<string, string> = {
    '--background': tokens.background,
    '--card': tokens.surface,
    '--popover': tokens.surface,
    '--foreground': tokens.text,
    '--card-foreground': tokens.text,
    '--muted': tokens.surfaceMuted,
    '--secondary': tokens.surfaceMuted,
    '--accent': tokens.surfaceMuted,
    '--muted-foreground': tokens.textMuted,
    '--border': tokens.border,
    '--input': tokens.borderStrong,
  };

  it.each(Object.entries(expected))('%s matches the shared token', (name, value) => {
    expect(vars[name]).toBe(value.toLowerCase());
  });
});
