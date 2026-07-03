import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { CreateDraftForm } from "@/components/draft/create-draft-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = { title: "New draft" };

export default async function NewDraftPage() {
  await requireUser();

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to drafts
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Create a new draft</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateDraftForm />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
