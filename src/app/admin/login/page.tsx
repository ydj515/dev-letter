import LoginForm from "./LoginForm";

interface LoginPageProps {
  searchParams: {
    redirect?: string;
  };
}

export default function AdminLoginPage({ searchParams }: LoginPageProps) {
  const redirectTo = normalizeRedirect(searchParams.redirect);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 p-6 text-gray-100">
      <div className="w-full max-w-md space-y-6 text-center">
        <div>
          <p className="text-sm uppercase tracking-wide text-emerald-300">Dev Letter</p>
          <h1 className="text-3xl font-semibold">Admin Login</h1>
          <p className="text-sm text-gray-400">
            운영 전용 페이지입니다. 발급된 단일 계정으로만 접근할 수 있습니다.
          </p>
        </div>
        <LoginForm redirectTo={redirectTo} />
      </div>
    </main>
  );
}

function normalizeRedirect(value?: string) {
  if (!value || !value.startsWith("/admin")) {
    return "/admin";
  }
  return value;
}
