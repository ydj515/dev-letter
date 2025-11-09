"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { authenticateAdmin } from "./actions";
import { initialLoginState } from "./state";

interface LoginFormProps {
  redirectTo?: string | null;
}

export default function LoginForm({ redirectTo }: LoginFormProps) {
  const [state, formAction] = useActionState(authenticateAdmin, initialLoginState);

  return (
    <form
      action={formAction}
      className="w-full max-w-sm mx-auto space-y-4 rounded-xl border border-gray-800 bg-gray-900/80 p-6 shadow-lg"
    >
      <input type="hidden" name="redirect" value={redirectTo ?? "/admin"} />
      <div>
        <label className="text-sm font-medium text-gray-300" htmlFor="username">
          아이디
        </label>
        <input
          required
          autoFocus
          name="username"
          id="username"
          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:border-emerald-400 focus:outline-none"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-300" htmlFor="password">
          비밀번호
        </label>
        <input
          required
          type="password"
          name="password"
          id="password"
          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:border-emerald-400 focus:outline-none"
        />
      </div>
      {state.error && <p className="text-sm text-rose-300">{state.error}</p>}
      <LoginButton />
    </form>
  );
}

function LoginButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-emerald-400 disabled:opacity-50"
    >
      {pending ? "확인 중..." : "로그인"}
    </button>
  );
}
