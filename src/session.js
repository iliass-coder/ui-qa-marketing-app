// Renew only in response to a person using the app. Background requests cannot keep it signed in.
export function watchSessionActivity({ renew, onExpired }) {
  const events = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "focus"];
  let lastAttempt = -Infinity;
  let inFlight = null;
  let stopped = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    for (const name of events) window.removeEventListener(name, activity);
    document.removeEventListener("visibilitychange", activity);
    inFlight?.abort();
  };

  const activity = (event) => {
    if (stopped || document.visibilityState !== "visible" || event?.isTrusted === false) return;
    const now = Date.now();
    if (inFlight || now - lastAttempt < 60000) return;
    lastAttempt = now;
    const controller = new AbortController();
    inFlight = controller;
    Promise.resolve()
      .then(() => stopped ? undefined : renew(controller.signal))
      .catch((error) => {
        if (!stopped && error.status === 401) {
          stop();
          onExpired();
        }
        // A network failure is retried on the next interaction after the throttle window.
      })
      .finally(() => { if (inFlight === controller) inFlight = null; });
  };

  for (const name of events) window.addEventListener(name, activity, { passive: true });
  document.addEventListener("visibilitychange", activity);
  activity();
  return stop;
}
