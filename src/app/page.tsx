import { redirect } from "next/navigation";
import { Clock, Radio, Trophy, Users } from "lucide-react";
import { AuthPanel } from "@/components/auth-panel";
import { PitchBackground } from "@/components/pitch-background";
import { getCurrentUser } from "@/server/auth";
import { TURN_SECONDS_MAX, TURN_SECONDS_MIN } from "@/lib/constants";

const FEATURES = [
  { icon: Users, label: "2 captains · 14 players" },
  { icon: Radio, label: "Real-time room" },
  { icon: Clock, label: `${TURN_SECONDS_MIN}–${TURN_SECONDS_MAX}s clock` },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="relative flex min-h-svh flex-col">
      <PitchBackground />

      <div className="relative flex flex-1 flex-col lg:flex-row">
        {/* Branding */}
        <section className="flex flex-col justify-center gap-4 px-6 pt-10 pb-4 text-center lg:flex-1 lg:gap-5 lg:px-14 lg:pb-10 lg:text-left">
          <span className="mx-auto inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium text-muted-foreground lg:mx-0">
            <Trophy className="size-3.5 text-primary" />
            Live captain drafts
          </span>

          <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Draft your football squad,{" "}
            <span className="text-primary">live and head-to-head.</span>
          </h1>

          <p className="mx-auto max-w-md text-pretty text-sm text-muted-foreground sm:text-base lg:mx-0">
            Invite a rival captain and take turns picking a 7-a-side squad. An
            adjustable shot clock keeps it moving — both squads fill up in real
            time.
          </p>

          <ul className="mx-auto flex flex-wrap justify-center gap-2 lg:mx-0 lg:justify-start">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-3 py-1 text-xs font-medium backdrop-blur-sm"
              >
                <Icon className="size-3.5 text-primary" />
                {label}
              </li>
            ))}
          </ul>
        </section>

        {/* Auth */}
        <section className="flex items-center justify-center px-6 pb-10 lg:flex-1 lg:pb-0">
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/85 p-6 shadow-lg backdrop-blur-md">
            <AuthPanel />
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Free to play · No app to install
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
