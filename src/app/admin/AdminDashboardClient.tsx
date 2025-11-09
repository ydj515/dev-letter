"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { InterestCategory } from "@prisma/client";
import type { AdminDashboardData, DashboardIssue } from "@/services/admin-dashboard";
import { approveIssueAction, generateIssueAction, resendIssueAction } from "./actions";

interface Props {
  data: AdminDashboardData;
}

export default function AdminDashboardClient({ data }: Props) {
  const router = useRouter();
  const [operator, setOperator] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [publishDate, setPublishDate] = useState(() => getToday());
  const [selectedCategory, setSelectedCategory] = useState<InterestCategory>(
    data.summary.categories[0]?.category ?? "Backend",
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      setOperator(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (operator) {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, operator);
    }
  }, [operator]);

  const percentFormatter = useMemo(
    () => new Intl.NumberFormat("ko-KR", { style: "percent", maximumFractionDigits: 1 }),
    [],
  );
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }),
    [],
  );

  const handleAction = (runner: () => Promise<unknown>, successMessage: string) => {
    if (!operator) {
      setErrorMessage("운영자 이름을 입력해 주세요. (감사 로그에 기록됩니다)");
      return;
    }

    setErrorMessage(null);
    startTransition(async () => {
      try {
        await runner();
        setStatusMessage(successMessage);
        router.refresh();
      } catch (error) {
        console.error(error);
        setStatusMessage(null);
        setErrorMessage(error instanceof Error ? error.message : "알 수 없는 오류가 발생했어요.");
      }
    });
  };

  const handleApprove = (issueId: string) =>
    handleAction(() => approveIssueAction({ issueId, actor: operator }), "이슈가 승인되었습니다.");

  const handleResend = (issueId: string) =>
    handleAction(() => resendIssueAction({ issueId, actor: operator }), "재발송이 실행되었습니다.");

  const handleGenerate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleAction(
      () =>
        generateIssueAction({
          category: selectedCategory,
          publishDate,
          actor: operator,
        }),
      "새 이슈를 생성했습니다.",
    );
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="총 발행"
          value={data.summary.totalIssues.toString()}
          hint="최근 10건 기준"
        />
        <StatCard
          label="대기 중"
          value={data.summary.pendingIssues.toString()}
          hint="SENT 상태 제외"
        />
        <StatCard
          label="실패한 이슈"
          value={data.summary.failedIssues.toString()}
          hint="failedCount > 0"
        />
        <StatCard
          label="평균 성공률"
          value={percentFormatter.format(data.summary.averageSuccessRate)}
          hint="전송 완료 대비 기준"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-2">
          <label className="text-sm font-semibold text-gray-200">운영자 이름</label>
          <input
            type="text"
            className="w-full rounded border border-gray-700 bg-gray-950 p-2 text-gray-100 focus:border-emerald-400 focus:outline-none"
            placeholder="e.g. ops-team"
            value={operator}
            onChange={(event) => setOperator(event.target.value)}
          />
          <p className="text-xs text-gray-500">
            모든 승인/재발송/생성 액션은 감사 로그에 기록되며, 운영자 이름이 필요합니다.
          </p>
        </div>

        <form
          onSubmit={handleGenerate}
          className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-200">즉시 콘텐츠 생성</p>
              <p className="text-xs text-gray-500">카테고리별 QA 세트를 바로 생성합니다.</p>
            </div>
            <button
              type="submit"
              disabled={isPending || !operator}
              className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-gray-900 disabled:opacity-40"
            >
              생성
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs uppercase text-gray-400">
              카테고리
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value as InterestCategory)}
                className="mt-1 w-full rounded border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-gray-100"
              >
                {data.summary.categories.map((entry) => (
                  <option key={entry.category} value={entry.category}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs uppercase text-gray-400">
              발행일
              <input
                type="date"
                value={publishDate}
                onChange={(event) => setPublishDate(event.target.value)}
                className="mt-1 w-full rounded border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-gray-100"
              />
            </label>
          </div>
        </form>
      </section>

      {statusMessage && (
        <div className="rounded border border-emerald-700 bg-emerald-950 p-3 text-sm text-emerald-200">
          {statusMessage}
        </div>
      )}
      {errorMessage && (
        <div className="rounded border border-rose-700 bg-rose-950/80 p-3 text-sm text-rose-200">
          {errorMessage}
        </div>
      )}

      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">최근 이슈</h2>
            <p className="text-sm text-gray-400">미리보기, 승인, 재발송 제어</p>
          </div>
        </header>
        <div className="space-y-4">
          {data.issues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onApprove={() => handleApprove(issue.id)}
              onResend={() => handleResend(issue.id)}
              isPending={isPending}
              percentFormatter={percentFormatter}
              dateFormatter={dateFormatter}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-white">감사 로그</h2>
          <p className="text-sm text-gray-400">최근 운영 액션 12건</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 divide-y divide-gray-800">
          {data.actions.length === 0 && (
            <p className="p-4 text-sm text-gray-400">최근 로그가 없습니다.</p>
          )}
          {data.actions.map((action) => (
            <div key={action.id} className="p-4 space-y-1">
              <p className="text-sm text-gray-200">
                <span className="font-semibold text-emerald-300">{action.actor}</span>{" "}
                <span className="text-gray-400">→ {formatAction(action.action)}</span>
                {action.issueTitle && (
                  <>
                    {" "}
                    <span className="text-gray-500">({action.issueTitle})</span>
                  </>
                )}
              </p>
              <p className="text-xs text-gray-500">
                {dateFormatter.format(new Date(action.createdAt))} · {action.categoryLabel ?? "-"}
              </p>
              {action.metadata && (
                <pre className="mt-2 overflow-auto rounded bg-gray-950 p-2 text-xs text-gray-300">
                  {JSON.stringify(action.metadata, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const LOCAL_STORAGE_KEY = "dev-letter:admin-operator";

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <p className="text-sm uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      <p className="text-xs text-gray-500">{hint}</p>
    </div>
  );
}

interface IssueCardProps {
  issue: DashboardIssue;
  onApprove: () => void;
  onResend: () => void;
  isPending: boolean;
  percentFormatter: Intl.NumberFormat;
  dateFormatter: Intl.DateTimeFormat;
}

function IssueCard({
  issue,
  onApprove,
  onResend,
  isPending,
  percentFormatter,
  dateFormatter,
}: IssueCardProps) {
  const canApprove = issue.status === "DRAFT";
  const qaPreview = issue.qaPairs.slice(0, 3);

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-gray-400">
            {issue.categoryLabel} · {new Date(issue.publishDate).toLocaleDateString("ko-KR")}
          </p>
          <h3 className="text-xl font-semibold text-white">{issue.title}</h3>
          <p className="text-xs text-gray-500">
            상태: <span className="font-mono">{issue.status}</span>
            {issue.sentAt && <> · 발송 완료 {dateFormatter.format(new Date(issue.sentAt))}</>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={!canApprove || isPending}
            className="rounded-md border border-emerald-500 px-3 py-1.5 text-sm font-medium text-emerald-300 disabled:opacity-30"
          >
            승인
          </button>
          <button
            type="button"
            onClick={onResend}
            disabled={isPending}
            className="rounded-md border border-cyan-500 px-3 py-1.5 text-sm font-medium text-cyan-300 disabled:opacity-30"
          >
            재발송
          </button>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-4 text-sm text-gray-300">
        <div>
          <dt className="text-xs uppercase text-gray-500">대상자 수</dt>
          <dd>{issue.deliveries}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-gray-500">성공률</dt>
          <dd>
            {issue.metric ? percentFormatter.format(issue.metric.successRate) : "데이터 없음"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-gray-500">성공/실패</dt>
          <dd>{issue.metric ? `${issue.metric.sentCount}/${issue.metric.failedCount}` : "-"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-gray-500">다음 큐</dt>
          <dd>{issue.metric ? issue.metric.pendingCount : "-"}</dd>
        </div>
      </dl>

      <div>
        <p className="text-sm font-semibold text-gray-200">QA 미리보기</p>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          {qaPreview.map((qa) => (
            <article
              key={qa.question}
              className="rounded border border-gray-800 bg-gray-950/70 p-3"
            >
              <p className="text-xs uppercase text-emerald-400">Q</p>
              <p className="text-sm font-medium text-white">{qa.question}</p>
              <p className="mt-2 text-xs uppercase text-cyan-400">A</p>
              <p className="text-sm text-gray-300 max-h-32 overflow-hidden">{qa.answer}</p>
            </article>
          ))}
          {qaPreview.length === 0 && <p className="text-sm text-gray-500">등록된 QA가 없습니다.</p>}
        </div>
      </div>
    </div>
  );
}

function formatAction(action: string) {
  switch (action) {
    case "approve_issue":
      return "승인";
    case "resend_issue":
      return "재발송";
    case "generate_issue":
      return "즉시 생성";
    default:
      return action;
  }
}

function getToday() {
  const date = new Date();
  return date.toISOString().slice(0, 10);
}
