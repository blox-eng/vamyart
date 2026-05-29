export type UmamiEventName =
  | "inquiry.submitted"
  | "bid.placed"
  | "checkout.completed"
  | "newsletter.subscribed";

let warned = false;

export async function trackEvent(
  name: UmamiEventName,
  data?: Record<string, unknown>,
): Promise<void> {
  const websiteId = process.env.UMAMI_WEBSITE_ID;
  const host = process.env.UMAMI_HOST || "https://cloud.umami.is";

  if (!websiteId) {
    if (!warned) {
      console.warn("[umami] UMAMI_WEBSITE_ID not set, skipping event tracking");
      warned = true;
    }
    return;
  }

  try {
    const res = await fetch(`${host}/api/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "vamy-server/1.0",
      },
      body: JSON.stringify({
        type: "event",
        payload: {
          website: websiteId,
          name,
          data: data ?? {},
          hostname: "vamy.art",
          url: "/",
          language: "en",
          screen: "1920x1080",
        },
      }),
    });

    if (!res.ok) {
      console.error("[umami] track failed", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[umami] fetch threw", err);
  }
}
