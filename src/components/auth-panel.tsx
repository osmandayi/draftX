import { GoogleSignInButton } from "@/components/google-signin-button";
import { EmailAuthForm } from "@/components/email-auth-form";

/** Google + email/password sign-in options, separated by an "or" divider. */
export function AuthPanel({ next }: { next?: string }) {
  return (
    <div className="space-y-4">
      <GoogleSignInButton
        next={next}
        label="Continue with Google"
        className="w-full"
      />
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <EmailAuthForm next={next} />
    </div>
  );
}
