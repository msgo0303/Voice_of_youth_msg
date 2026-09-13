import { QuestionType } from '@/types/database';

export function encodeQuestionForDb<T extends { type: QuestionType; options?: any }>(q: T): T {
  let dbType: string = q.type;
  let rawOptions: string[] = Array.isArray(q.options) ? [...q.options] : [];

  // Clean out any existing __type: tags to prevent duplication
  rawOptions = rawOptions.filter(opt => typeof opt === 'string' && !opt.startsWith('__type:'));

  if (q.type === 'SHORT_TEXT') {
    dbType = 'CHECKBOX';
    rawOptions = ['__type:SHORT_TEXT__', ...rawOptions];
  } else if (q.type === 'LONG_TEXT') {
    dbType = 'CHECKBOX';
    rawOptions = ['__type:LONG_TEXT__', ...rawOptions];
  } else if (q.type === 'SINGLE_CHOICE') {
    dbType = 'DROPDOWN';
    rawOptions = ['__type:SINGLE_CHOICE__', ...rawOptions];
  }

  return {
    ...q,
    type: dbType as any,
    options: rawOptions
  };
}

export function decodeQuestionFromDb<T extends { type: string; options?: any }>(q: T): T {
  let uiType: QuestionType = q.type as QuestionType;
  let rawOptions: string[] = Array.isArray(q.options) ? [...q.options] : [];

  if (rawOptions.length > 0 && typeof rawOptions[0] === 'string' && rawOptions[0].startsWith('__type:')) {
    const tag = rawOptions[0];
    if (tag === '__type:SHORT_TEXT__') uiType = 'SHORT_TEXT';
    else if (tag === '__type:LONG_TEXT__') uiType = 'LONG_TEXT';
    else if (tag === '__type:SINGLE_CHOICE__') uiType = 'SINGLE_CHOICE';

    rawOptions = rawOptions.slice(1);
  }

  return {
    ...q,
    type: uiType as any,
    options: rawOptions
  };
}
