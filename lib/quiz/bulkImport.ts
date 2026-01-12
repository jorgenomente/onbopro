export type ParsedBulkQuestion = {
  index: number;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explain?: string | null;
  rawBlock: string;
  errors: string[];
};

type ParsedFieldMap = Record<string, string>;

type ParsedBlock = {
  rawBlock: string;
  fields: ParsedFieldMap;
  errors: string[];
};

const REQUIRED_KEYS = ['Q', 'A1', 'A2', 'A3', 'A4', 'CORRECT'] as const;

export function parseOnboQuizBulk(text: string): ParsedBulkQuestion[] {
  const blocks = splitBlocks(text);
  return blocks.map((block, idx) => {
    const parsed = parseBlock(block);
    return toParsedQuestion(parsed, idx + 1);
  });
}

export function buildBulkImportErrorReport(
  questions: ParsedBulkQuestion[],
): string {
  const lines: string[] = [];
  for (const item of questions) {
    if (item.errors.length === 0) continue;
    lines.push(`Bloque ${item.index}:`);
    for (const error of item.errors) {
      lines.push(`- ${error}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

function splitBlocks(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const blocks: string[] = [];
  let current: string[] = [];

  const pushCurrent = () => {
    const trimmed = current.join('\n').trim();
    if (trimmed) {
      blocks.push(trimmed);
    }
    current = [];
  };

  for (const line of lines) {
    if (line.trim() === '---') {
      pushCurrent();
      continue;
    }
    current.push(line);
  }

  pushCurrent();
  return blocks;
}

function parseBlock(rawBlock: string): ParsedBlock {
  const fields: ParsedFieldMap = {};
  const errors: string[] = [];
  const lines = rawBlock.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      errors.push(`Linea sin ':' -> "${line.trim()}"`);
      continue;
    }
    const rawKey = line.slice(0, separatorIndex).trim().toUpperCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (!rawKey) {
      errors.push(`Clave vacia en linea "${line.trim()}"`);
      continue;
    }
    if (!fields[rawKey]) {
      fields[rawKey] = value;
    } else if (value) {
      fields[rawKey] = `${fields[rawKey]}\n${value}`;
    }
  }

  for (const key of REQUIRED_KEYS) {
    if (!fields[key] || !fields[key].trim()) {
      errors.push(`Falta ${key}`);
    }
  }

  return { rawBlock, fields, errors };
}

function toParsedQuestion(
  parsed: ParsedBlock,
  index: number,
): ParsedBulkQuestion {
  const errors = [...parsed.errors];
  const prompt = parsed.fields.Q?.trim() ?? '';
  const choices = [
    parsed.fields.A1?.trim() ?? '',
    parsed.fields.A2?.trim() ?? '',
    parsed.fields.A3?.trim() ?? '',
    parsed.fields.A4?.trim() ?? '',
  ];

  for (let i = 0; i < choices.length; i += 1) {
    if (!choices[i]) {
      errors.push(`A${i + 1} vacia`);
    }
  }

  let correctIndex = -1;
  const rawCorrect = parsed.fields.CORRECT?.trim();
  if (rawCorrect) {
    const parsedCorrect = Number(rawCorrect);
    if (
      !Number.isInteger(parsedCorrect) ||
      parsedCorrect < 1 ||
      parsedCorrect > 4
    ) {
      errors.push('CORRECT debe ser 1, 2, 3 o 4');
    } else {
      correctIndex = parsedCorrect - 1;
    }
  }

  const explain = parsed.fields.EXPLAIN?.trim() || null;

  if (!prompt) {
    errors.push('Q vacia');
  }

  return {
    index,
    prompt,
    choices,
    correctIndex,
    explain,
    rawBlock: parsed.rawBlock,
    errors: dedupeErrors(errors),
  };
}

function dedupeErrors(list: string[]): string[] {
  return Array.from(new Set(list));
}
