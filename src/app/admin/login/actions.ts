"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { encodeAdminCredentials } from "@/lib/admin-auth";
import type { LoginState } from "./state";

export async function authenticateAdmin(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = (formData.get("username")?.toString() ?? "").trim();
  const password = (formData.get("password")?.toString() ?? "").trim();
  const redirectPath = sanitizeRedirect(formData.get("redirect")?.toString());

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    return { error: "관리자 계정 환경 변수가 설정되지 않았습니다." };
  }

  if (username !== adminUsername || password !== adminPassword) {
    return { error: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }

  const token = encodeAdminCredentials(adminUsername, adminPassword);
  const store = await cookies();
  store.set("admin-auth", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  redirect(redirectPath ?? "/admin");
}

export async function logoutAdmin() {
  const store = await cookies();
  store.delete("admin-auth");
  redirect("/admin/login");
}

function sanitizeRedirect(value: string | undefined) {
  if (!value) return null;
  if (!value.startsWith("/admin")) return null;
  return value;
}
