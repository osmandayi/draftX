import { redirect } from "next/navigation";
import { Clock, Radio, Trophy, Users } from "lucide-react";
import { AuthPanel } from "@/components/auth-panel";
import { PitchBackground } from "@/components/pitch-background";
import { getCurrentUser } from "@/server/auth";
import { TURN_SECONDS_MAX, TURN_SECONDS_MIN } from "@/lib/constants";

const FEATURES = [
  {
    icon: Users,
    title: "Two captains, 14 players",
    body: "Invite a rival captain and build a balanced 7-a-side squad from a shared pool.",
  },
  {
    icon: Radio,
    title: "Real-time draft room",
    body: "Every pick updates both captains instantly over Supabase Realtime — no refresh.",
  },
  {
    icon: Clock,
    title: "Adjustable shot clock",
    body: `Set each turn from ${TURN_SECONDS_MIN} to ${TURN_SECONDS_MAX} seconds. Run out the clock and the engine auto-picks for you.`,
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex flex-1 flex-col">
      <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-5 py-16 text-center">
        <PitchBackground />
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Trophy className="size-3.5 text-primary" />
          Live captain drafts
        </span>

        <h1 className="max-w-2xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">
          Draft your football squad,{" "}
          <span className="text-primary">live and head-to-head.</span>
        </h1>

        <p className="mt-5 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
          Create a draft, invite a second captain, and take turns picking from a
          pool of 12 players. An adjustable shot clock keeps it moving — both
          squads fill up in real time.
        </p>

        <div className="mt-8 w-full max-w-xs rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm backdrop-blur-sm">
          <AuthPanel />
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Free to play · No app to install
          </p>
        </div>
      </section>

      <section className="border-t border-border/60 bg-card/40 px-5 py-12">
        <div className="mx-auto grid w-full max-w-4xl gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="flex flex-col rounded-xl border border-border/60 bg-card p-6 text-left"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-6" />
              </span>
              <h3 className="mt-4 text-base font-semibold tracking-tight">
                {title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
