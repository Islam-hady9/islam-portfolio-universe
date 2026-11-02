/**
 * Lexical index over the approved records (PIE spec §6 ranking). MiniSearch with field boosts
 * (aliases > title/keywords > text), conservative prefix/fuzzy matching and a coverage
 * threshold: a result is evidence only when it matches enough of the question's content words.
 * Shared by Smart Mode and Local AI retrieval (one corpus, one index).
 */
import MiniSearch from 'minisearch';
import type { KnowledgeManifest, KnowledgeRecord } from '../shared/types';
import { contentTokens, isStopword, tokenize, variants } from './normalize';

export interface Hit {
  record: KnowledgeRecord;
  score: number;
  /** Distinct question words this record matched. */
  matched: string[];
  /** matched / question content words. */
  coverage: number;
}

interface IndexedDoc {
  id: string;
  title: string;
  text: string;
  keywords: string;
  aliases: string;
}

/** Words too generic to count as evidence on their own (the subject's name, filler verbs). */
const WEAK = new Set([
  'islam',
  'abd',
  'elhady',
  'abdelhady',
  'اسلام',
  'work',
  'works',
  'thing',
  'things',
  'stuff',
  'info',
  'information',
]);

export class KnowledgeIndex {
  readonly version: string;
  readonly records: ReadonlyMap<string, KnowledgeRecord>;
  private readonly search: MiniSearch<IndexedDoc>;

  constructor(manifest: KnowledgeManifest) {
    this.version = manifest.version;
    this.records = new Map(manifest.records.map((r) => [r.id, r]));
    this.search = new MiniSearch<IndexedDoc>({
      fields: ['title', 'text', 'keywords', 'aliases'],
      storeFields: [],
      tokenize: (text) => tokenize(text),
      processTerm: (term) => (isStopword(term) ? null : variants(term)),
      searchOptions: {
        boost: { aliases: 3, title: 2, keywords: 2, text: 1 },
        prefix: (term) => term.length >= 5,
        fuzzy: (term) => (term.length >= 6 ? 0.15 : false),
        combineWith: 'OR',
      },
    });
    this.search.addAll(
      manifest.records.map((r) => ({
        id: r.id,
        title: r.title,
        text: r.publicText,
        keywords: r.keywords.join(' '),
        aliases: r.aliases.join(' '),
      })),
    );
  }

  /** Ranked hits with coverage; callers decide the evidence threshold. */
  query(question: string, limit = 4): Hit[] {
    const words = [...new Set(contentTokens(question))];
    if (words.length === 0) return [];
    const strong = words.filter((w) => !WEAK.has(w));
    const results = this.search.search(question);
    return results.slice(0, limit).map((r) => {
      const record = this.records.get(String(r.id))!;
      const matchedWords = words.filter((w) =>
        variants(w).some((v) => r.terms.some((t) => t === v || t.startsWith(v))),
      );
      const matchedStrong = matchedWords.filter((w) => !WEAK.has(w));
      return {
        record,
        score: r.score,
        matched: matchedWords,
        coverage: strong.length ? matchedStrong.length / strong.length : 0,
      };
    });
  }

  /** Records whose text mentions a term (used to check technology names against the corpus). */
  mentions(term: string): KnowledgeRecord[] {
    const wanted = tokenize(term);
    if (wanted.length === 0) return [];
    const out: KnowledgeRecord[] = [];
    for (const record of this.records.values()) {
      const tokens = tokenize(`${record.title} ${record.publicText}`);
      const found = tokens.some((_, i) => wanted.every((w, j) => tokens[i + j] === w));
      if (found) out.push(record);
    }
    return out;
  }
}
