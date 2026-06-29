/** Developer support email (Play Console, privacy policy, in-app mailto). */
export const SUPPORT_EMAIL = "kmvalley.studio@gmail.com";

export function supportMailtoUrl(options: { subject: string; body?: string }): string {
  const params = new URLSearchParams();
  params.set("subject", options.subject);
  if (options.body?.trim()) params.set("body", options.body.trim());
  const qs = params.toString();
  return `mailto:${SUPPORT_EMAIL}${qs ? `?${qs}` : ""}`;
}
