import { studyBudgetSlugParam, type StudyBudgetArticle } from './content';
import { getTrackerDeanery } from './tracker';

/**
 * Which /study-budget/ pages carry the tracker widget.
 *
 * The tracker JSON keys each deanery by the same slug as its route, so no
 * translation is needed — a page gets the widget iff the tracker has an entry
 * for it. The three support pages (exam fee, how to claim, GP0001) have no
 * entry and therefore mount nothing, matching the build package's mount table.
 */
export function deaneryIdForArticle(article: StudyBudgetArticle): string | undefined {
  const slug = studyBudgetSlugParam(article);
  return getTrackerDeanery(slug) ? slug : undefined;
}
