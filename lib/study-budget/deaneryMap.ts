import { studyBudgetSlugParam, type StudyBudgetArticle } from './content';

/**
 * Study-budget page slug → the deanery id used by the existing checker widget
 * (`lib/landing/studyBudget.ts`).
 *
 * The build package expects a `study-budget-tracker-data.json` for the widget;
 * that file was not supplied, so the widget keeps reading the deanery data the
 * site already ships — which carries the same verdict / cap / policy URL /
 * drafted email per deanery. The two use different id spellings, hence this map.
 *
 * South West maps to `severn`: the article is "South West (Severn and
 * Peninsula)" and its sourced detail is the Severn (Bristol) patch.
 *
 * The three support pages (exam fee, how to claim, GP0001) mount no widget,
 * per the build package's mount table, so they are deliberately absent.
 */
const SLUG_TO_DEANERY_ID: Readonly<Record<string, string>> = {
  london: 'london',
  kss: 'kss',
  'east-of-england': 'eoe',
  'thames-valley': 'tv',
  wessex: 'wessex',
  'east-midlands': 'em',
  'west-midlands': 'wm',
  'north-west': 'nw',
  'yorkshire-humber': 'yh',
  'north-east': 'ne',
  'south-west': 'severn',
  scotland: 'scotland',
  wales: 'wales',
  'northern-ireland': 'ni',
};

/** The deanery id to pre-select, or undefined for pages with no widget. */
export function deaneryIdForArticle(article: StudyBudgetArticle): string | undefined {
  return SLUG_TO_DEANERY_ID[studyBudgetSlugParam(article)];
}
