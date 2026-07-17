export class TrackedLinkUrlValidationError extends Error {
  constructor(message = "Tracked link destination must be an absolute http or https URL") {
    super(message);
    this.name = "TrackedLinkUrlValidationError";
    this.code = "INVALID_TRACKED_LINK_URL";
    this.status = 400;
  }
}

export function validateTrackedLinkDestination(value) {
  if (typeof value !== "string") {
    throw new TrackedLinkUrlValidationError();
  }

  const rawValue = value.trim();
  if (!rawValue) {
    throw new TrackedLinkUrlValidationError();
  }

  let parsed;
  try {
    parsed = new URL(rawValue);
  } catch {
    throw new TrackedLinkUrlValidationError();
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  ) {
    throw new TrackedLinkUrlValidationError();
  }

  return parsed.toString();
}

export function validateTrackedLinks(trackedLinks = []) {
  if (!Array.isArray(trackedLinks)) {
    throw new TrackedLinkUrlValidationError();
  }

  return trackedLinks.map((link) => {
    if (!link || typeof link !== "object" || Array.isArray(link)) {
      throw new TrackedLinkUrlValidationError();
    }

    return {
      ...link,
      destinationUrl: validateTrackedLinkDestination(link.destinationUrl),
    };
  });
}
