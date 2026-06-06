import React from "react";

const GithubIcon = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

interface GithubTabProps {
  repos: any[];
  allTeams: any[];
  linkingTeamId: string;
  setLinkingTeamId: (id: string) => void;
  manualRepoName: string;
  setManualRepoName: (name: string) => void;
  manualRepoUrl: string;
  setManualRepoUrl: (url: string) => void;
  syncingRepoId: string;
  handleCreateRepo: (teamId: string) => Promise<void>;
  handleLinkRepo: (e: React.FormEvent) => Promise<void>;
  handleSyncRepo: (repoId: string) => Promise<void>;
}

export default function GithubTab({
  repos,
  allTeams,
  linkingTeamId,
  setLinkingTeamId,
  manualRepoName,
  setManualRepoName,
  manualRepoUrl,
  setManualRepoUrl,
  syncingRepoId,
  handleCreateRepo,
  handleLinkRepo,
  handleSyncRepo,
}: GithubTabProps) {
  return (
    <div className="glass p-6 rounded-2xl w-full mt-2 space-y-6 font-mono">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <GithubIcon size={18} className="text-cyan-400" />
        <span>Quản lý GitHub Repositories của các đội thi</span>
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Repos List */}
        <div className="lg:col-span-2 space-y-4">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Danh sách Repositories ({repos.length})
          </h4>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {repos.map((r: any) => (
              <div
                key={r._id}
                className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-xs"
              >
                <div className="space-y-1">
                  <p className="font-bold text-slate-200">
                    {r.teamId?.name || "Đội thi"}
                  </p>
                  <a
                    href={r.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline break-all block"
                  >
                    {r.repoUrl || r.repoName}
                  </a>
                  <div className="flex gap-2 text-[10px] text-slate-400">
                    <span>
                      Mặc định:{" "}
                      <span className="text-slate-300 font-semibold">
                        {r.defaultBranch || "main"}
                      </span>
                    </span>
                    <span>•</span>
                    <span>
                      Đồng bộ cuối:{" "}
                      <span className="text-slate-300">
                        {r.lastSyncedAt
                          ? new Date(r.lastSyncedAt).toLocaleString()
                          : "Chưa đồng bộ"}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.syncStatus === "success"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : r.syncStatus === "syncing"
                        ? "bg-cyan-500/10 text-cyan-400 animate-pulse border border-cyan-500/20"
                        : r.syncStatus === "failed"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-slate-800 text-slate-400 border border-slate-700/50"
                    }`}
                  >
                    {r.syncStatus.toUpperCase()}
                  </span>
                  <button
                    onClick={() => handleSyncRepo(r._id)}
                    disabled={syncingRepoId === r._id}
                    className="bg-cyan-500 hover:bg-cyan-500 disabled:bg-indigo-850 text-white px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer disabled:cursor-not-allowed"
                  >
                    {syncingRepoId === r._id ? "Đang đồng bộ..." : "Đồng bộ AI"}
                  </button>
                </div>
              </div>
            ))}
            {repos.length === 0 && (
              <p className="text-xs text-slate-500 italic">
                Chưa có repository nào được cấu hình cho cuộc thi này.
              </p>
            )}
          </div>
        </div>

        {/* Provision or Link Repo */}
        <div className="space-y-6">
          {/* Auto Provision list */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Cấp Repo tự động
            </h4>
            <p className="text-[10px] text-slate-500">
              Tạo repo riêng tư trong tổ chức GitHub và phân quyền cho các
              thành viên đã xác nhận.
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {allTeams
                .filter((t: any) => !repos.some((r: any) => r.teamId?._id === t._id))
                .map((t: any) => (
                  <div
                    key={t._id}
                    className="bg-slate-900/30 p-2.5 rounded-xl border border-slate-800/80 flex justify-between items-center text-xs"
                  >
                    <span className="font-semibold text-slate-300 truncate max-w-[120px]">
                      {t.name}
                    </span>
                    <button
                      onClick={() => handleCreateRepo(t._id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-lg text-[9px] font-bold cursor-pointer"
                    >
                      Tạo Repo
                    </button>
                  </div>
                ))}
              {allTeams.filter(
                (t: any) => !repos.some((r: any) => r.teamId?._id === t._id),
              ).length === 0 && (
                <p className="text-[10px] text-slate-500 italic">
                  Tất cả đội đã xác nhận đã được cấp repo.
                </p>
              )}
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Manual Link Form */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Liên kết repo thủ công
            </h4>
            <form onSubmit={handleLinkRepo} className="space-y-2">
              <select
                value={linkingTeamId}
                onChange={(e) => setLinkingTeamId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg text-xs bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none"
              >
                <option value="">Chọn đội...</option>
                {allTeams
                  .filter((t: any) => !repos.some((r: any) => r.teamId?._id === t._id))
                  .map((t: any) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
              </select>
              <input
                type="text"
                placeholder="Tên Repo (e.g. team-alpha-repo)"
                value={manualRepoName}
                onChange={(e) => setManualRepoName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg text-xs bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none"
              />
              <input
                type="url"
                placeholder="Link Repo (https://github.com/...)"
                value={manualRepoUrl}
                onChange={(e) => setManualRepoUrl(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg text-xs bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none"
              />
              <button
                type="submit"
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2 rounded-lg cursor-pointer"
              >
                Liên Kết Repository
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
