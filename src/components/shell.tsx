import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  ClipboardCheck,
  FolderKanban,
  ExternalLink,
  Gauge,
  IdCard,
  LayoutDashboard,
  Library,
  ListChecks,
  ListTodo,
  Menu,
  MessagesSquare,
  Network,
  ScrollText,
  Search,
  Settings,
  Users,
  Waypoints,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/bits";
import { OpsRail } from "@/components/ops-rail";
import { cn } from "@/lib/cn";
import { getSnapshot, useOs } from "@/lib/store";

export type AppSearch = { view: string; id: string; q: string };

const NAV = [
  {
    group: "Điều hành",
    items: [
      { view: "ceo", label: "Chat AI đa năng", icon: MessagesSquare },
      { view: "overview", label: "Tổng quan điều hành", icon: LayoutDashboard },
      { view: "dispatch", label: "Trung tâm giao việc", icon: ListTodo },
      { view: "orchestrator", label: "Bộ điều phối tự động", icon: Waypoints },
    ],
  },
  {
    group: "Nhân sự",
    items: [
      { view: "org", label: "Sơ đồ tổ chức", icon: Network },
      { view: "staff", label: "Danh sách nhân sự", icon: Users },
      { view: "matrix", label: "Hồ sơ năng lực", icon: IdCard },
      { view: "reviews", label: "Kiểm tra và đánh giá", icon: ClipboardCheck },
    ],
  },
  {
    group: "Vận hành",
    items: [
      { view: "quotas", label: "Hạn mức và token", icon: Gauge },
      { view: "projects", label: "Quản lý dự án", icon: FolderKanban },
      { view: "tasks", label: "Theo dõi nhiệm vụ", icon: ListChecks },
      { view: "reports", label: "Báo cáo CEO", icon: BarChart3 },
    ],
  },
  {
    group: "Hệ thống",
    items: [
      { view: "docs", label: "Kho tài liệu", icon: Library },
      { view: "activity", label: "Lịch sử hoạt động", icon: ScrollText },
      { view: "settings", label: "Cài đặt và tích hợp", icon: Settings },
    ],
  },
] as const;

function activeView(view: string) {
  if (view === "profile") return "staff";
  return view;
}

function NavLinks({ search, onPick }: { search: AppSearch; onPick?: () => void }) {
  const current = activeView(search.view);
  return (
    <div className="flex flex-col gap-5">
      {NAV.map((group) => (
        <div key={group.group}>
          <p className="px-3 font-mono text-xs text-faint">{group.group}</p>
          <div className="mt-1 flex flex-col gap-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const on = current === item.view;
              return (
                <Link
                  key={item.view}
                  to="/"
                  search={{ view: item.view, id: "", q: item.view === "staff" ? search.q : "" }}
                  onClick={onPick}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-md px-3 text-sm",
                    on ? "border border-line bg-subtle text-fg" : "text-muted",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Side({ search, onPick }: { search: AppSearch; onPick?: () => void }) {
  const orgName = useOs((state) => state.settings.orgName);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-3 py-4">
        <BrandMark />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-fg">{orgName}</p>
          <p className="font-mono text-xs text-faint">Tầng điều hành</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <NavLinks search={search} onPick={onPick} />
      </div>
      <p className="border-t border-line px-4 py-3 text-xs text-faint">AI COMPANY OS · dữ liệu đồng bộ qua máy chủ</p>
    </div>
  );
}

export function Shell({ search, children }: { search: AppSearch; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [offline, setOffline] = useState(false);
  const [query, setQuery] = useState(search.q);
  const notice = useOs((state) => state.notice);
  const setNotice = useOs((state) => state.setNotice);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    let saveTimer: number | undefined;

    const syncWorkspace = async () => {
      await Promise.resolve(useOs.persist.rehydrate());
      try {
        const { loadWorkspaceSnapshot, saveWorkspaceSnapshot } = await import("@/lib/workspace.functions");
        const remote = await loadWorkspaceSnapshot();
        if (!active) return;
        if (remote) {
          useOs.getState().importSnapshot(remote);
        } else {
          await saveWorkspaceSnapshot({ data: { snapshot: getSnapshot() } });
        }

        let previous = JSON.stringify(getSnapshot());
        unsubscribe = useOs.subscribe(() => {
          if (!active) return;
          const next = JSON.stringify(getSnapshot());
          if (next === previous) return;
          previous = next;
          if (saveTimer !== undefined) window.clearTimeout(saveTimer);
          saveTimer = window.setTimeout(() => {
            void saveWorkspaceSnapshot({ data: { snapshot: getSnapshot() } }).catch(() => {
              useOs.getState().setNotice("Không đồng bộ được dữ liệu lên máy chủ. Dữ liệu trên trình duyệt vẫn còn.");
            });
          }, 900);
        });
      } catch (error) {
        console.error("[workspace] remote sync unavailable:", error);
        if (active) {
          useOs.getState().setNotice("Chưa kết nối được kho dữ liệu máy chủ. Dữ liệu hiện tại vẫn lưu trên trình duyệt này.");
        }
      } finally {
        if (active) useOs.getState().markHydrated();
      }
    };

    void syncWorkspace();
    return () => {
      active = false;
      unsubscribe?.();
      if (saveTimer !== undefined) window.clearTimeout(saveTimer);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
    setQuery(search.q);
    const titles: Record<string, string> = {
      overview: "Tổng quan",
      ceo: "Chat với CEO",
      dispatch: "Trung tâm giao việc",
      orchestrator: "Bộ điều phối",
      org: "Sơ đồ tổ chức",
      staff: "Nhân sự",
      matrix: "Hồ sơ năng lực",
      profile: "Hồ sơ AI",
      reviews: "Đánh giá",
      quotas: "Hạn mức",
      projects: "Dự án",
      tasks: "Nhiệm vụ",
      reports: "Báo cáo CEO",
      docs: "Kho tài liệu",
      activity: "Lịch sử",
      settings: "Cài đặt",
    };
    document.title = `${titles[search.view] ?? "Điều hành"} · AI COMPANY OS`;
  }, [search.view, search.id, search.q]);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("offline", sync);
    window.addEventListener("online", sync);
    return () => {
      window.removeEventListener("offline", sync);
      window.removeEventListener("online", sync);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice, setNotice]);

  return (
    <div className="min-h-dvh bg-bg text-fg lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-line bg-elevated lg:flex">
        <Side search={search} />
      </aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-bg/80" aria-label="Đóng menu" onClick={() => setOpen(false)} />
          <aside className="drawer relative flex h-full w-64 flex-col border-r border-line bg-elevated">
            <Side search={search} onPick={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1">
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line bg-bg/95 px-3 shadow-sm backdrop-blur lg:px-6">
            <button className="press grid h-11 w-11 place-items-center rounded-md border border-line lg:hidden" onClick={() => setOpen(true)} aria-label="Mở menu">
              {open ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
            <form
              className="flex min-w-0 flex-1 items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void navigate({ to: "/", search: { view: "staff", id: "", q: query.trim() } });
              }}
            >
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Tìm nhân sự</span>
                <Search className="pointer-events-none absolute top-3 left-3 size-4 text-faint" aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm nhân sự, phòng ban, mã"
                  className="h-12 w-full rounded-xl border border-line bg-elevated pr-3 pl-10 text-base text-fg placeholder:text-faint"
                />
              </label>
              <button type="submit" className="press hidden h-11 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg sm:inline-flex sm:items-center">
                Tìm
              </button>
            </form>
            <span className="hidden shrink-0 rounded-md border border-line px-2 py-1 font-mono text-xs text-accent md:inline">
              Chủ tịch · mô phỏng
            </span>
            <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-line px-3 text-sm text-fg hover:bg-subtle">
              <ExternalLink className="size-4" /> ChatGPT
            </a>
          </header>
          {offline ? (
            <p role="status" className="border-b border-line bg-subtle px-4 py-2 text-sm text-warn">
              Mất kết nối. Việc và nhân sự đang mở vẫn nằm trên máy này. Tải lại trang lúc mất mạng thì trình duyệt không lấy được giao diện.
            </p>
          ) : null}
          {notice ? (
            <p role="status" className="border-b border-line bg-subtle px-4 py-2 text-sm text-fg">
              {notice}
            </p>
          ) : null}
          <main key={`${search.view}:${search.id}`} className="rise mx-auto w-full max-w-6xl px-4 py-5 lg:px-6">
            {children}
          </main>
        </div>
        <OpsRail />
      </div>
    </div>
  );
}
