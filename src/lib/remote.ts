/**
 * Remote-ness detection for sources that are not remote-only by policy.
 *
 * Dedicated remote boards (We Work Remotely, RemoteOK, Remotive, Jobicy) are
 * trusted as remote by definition. Everything scraped from company ATS boards
 * must prove itself: the posting has to mention remote work in its title,
 * tags or description.
 */
const REMOTE_RX =
  /\bremote\b|work from home|\bwfh\b|work anywhere|fully distributed|telecommut|remote[- ]first|work remotely/i;

export function isRemotePosting(
  title: string,
  tags: string[],
  descriptionHtml: string
): boolean {
  const plain = (descriptionHtml ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 4000);
  return REMOTE_RX.test(`${title} ${tags.join(" ")} ${plain}`);
}
