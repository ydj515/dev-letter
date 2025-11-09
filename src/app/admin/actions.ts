"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { InterestCategory } from "@prisma/client";
import { approveIssue, generateIssue, resendIssue } from "@/services/admin-dashboard";

export async function approveIssueAction(input: { issueId: string; actor: string }) {
  const result = await approveIssue(input.issueId, input.actor);
  revalidatePath("/admin");
  return result;
}

export async function resendIssueAction(input: { issueId: string; actor: string }) {
  const result = await resendIssue(input.issueId, input.actor);
  revalidatePath("/admin");
  return result;
}

export async function generateIssueAction(input: {
  category: InterestCategory;
  publishDate?: string;
  actor: string;
}) {
  const publishDate = input.publishDate ? new Date(input.publishDate) : undefined;
  const result = await generateIssue({ category: input.category, publishDate }, input.actor);
  revalidatePath("/admin");
  return result;
}

export async function logoutAdminAction() {
  cookies().delete("admin-auth");
  redirect("/admin/login");
}
