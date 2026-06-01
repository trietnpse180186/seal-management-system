import React from "react";
import { ListOrdered, ChevronRight, Award, Lock } from "lucide-react";

interface RoundsTabProps {
  selectedEvent: any;
  tracks: any[];
  rounds: any[];
  selectedTrack: any;
  setSelectedTrack: (track: any) => void;
  selectedRubricRoundId: string;
  setSelectedRubricRoundId: (id: string) => void;

  // Create Round form props
  roundName: string;
  setRoundName: (val: string) => void;
  roundOrder: string;
  setRoundOrder: (val: string) => void;
  roundDeadline: string;
  setRoundDeadline: (val: string) => void;
  roundLimit: string;
  setRoundLimit: (val: string) => void;
  rubricTypeOption: "new" | "existing";
  setRubricTypeOption: (val: "new" | "existing") => void;
  existingRubrics: any[];
  selectedSourceRubricId: string;
  setSelectedSourceRubricId: (val: string) => void;
  rubricName: string;
  setRubricName: (val: string) => void;
  handleCreateRound: (e: React.FormEvent) => Promise<void>;

  // Rubric Display & Edit props
  rubric: any;
  criteria: any[];
  editingRubric: boolean;
  setEditingRubric: (val: boolean) => void;
  editRubricName: string;
  setEditRubricName: (val: string) => void;
  editRubricDesc: string;
  setEditRubricDesc: (val: string) => void;
  editRubricTotalWeight: string;
  setEditRubricTotalWeight: (val: string) => void;
  editRubricMaxScore: string;
  setEditRubricMaxScore: (val: string) => void;
  editRubricIsActive: boolean;
  setEditRubricIsActive: (val: boolean) => void;
  handleUpdateRubric: (e: React.FormEvent) => Promise<void>;
  handleDeleteRubric: () => Promise<void>;
  handleLockRubric: () => Promise<void>;

  // Criteria props
  critCode: string;
  setCritCode: (val: string) => void;
  critName: string;
  setCritName: (val: string) => void;
  critWeight: string;
  setCritWeight: (val: string) => void;
  critDesc: string;
  setCritDesc: (val: string) => void;
  critMaxScore: string;
  setCritMaxScore: (val: string) => void;
  critGradingLevels: any[];
  setCritGradingLevels: React.Dispatch<React.SetStateAction<any[]>>;
  editingCriterion: any;
  setEditingCriterion: (val: any) => void;
  handleSaveCriterion: (e: React.FormEvent) => Promise<void>;
  handleDeleteCriterion: (criterionId: string) => Promise<void>;
  handleStartEditCriterion: (c: any) => void;
  handleCancelEditCriterion: () => void;

  // Grading levels props
  levelLabel: string;
  setLevelLabel: (val: string) => void;
  levelMinScore: string;
  setLevelMinScore: (val: string) => void;
  levelMaxScore: string;
  setLevelMaxScore: (val: string) => void;
  levelDesc: string;
  setLevelDesc: (val: string) => void;
  handleAddGradingLevel: () => void;
  handleRemoveGradingLevel: (index: number) => void;

  // Rubric creation fallback props
  handleCreateRubric: (e: React.FormEvent) => Promise<void>;

  loading: boolean;
  setRubric: (rubric: any) => void;
  setCriteria: (criteria: any[]) => void;
}

export default function RoundsTab({
  tracks,
  rounds,
  selectedTrack,
  setSelectedTrack,
  selectedRubricRoundId,
  setSelectedRubricRoundId,

  roundName,
  setRoundName,
  roundOrder,
  setRoundOrder,
  roundDeadline,
  setRoundDeadline,
  roundLimit,
  setRoundLimit,
  rubricTypeOption,
  setRubricTypeOption,
  existingRubrics,
  selectedSourceRubricId,
  setSelectedSourceRubricId,
  rubricName,
  setRubricName,
  handleCreateRound,

  rubric,
  criteria,
  editingRubric,
  setEditingRubric,
  editRubricName,
  setEditRubricName,
  editRubricDesc,
  setEditRubricDesc,
  setEditRubricTotalWeight,
  editRubricMaxScore,
  setEditRubricMaxScore,
  editRubricIsActive,
  setEditRubricIsActive,
  handleUpdateRubric,
  handleDeleteRubric,
  handleLockRubric,

  critCode,
  setCritCode,
  critName,
  setCritName,
  critWeight,
  setCritWeight,
  critDesc,
  setCritDesc,
  critMaxScore,
  setCritMaxScore,
  critGradingLevels,
  editingCriterion,
  handleSaveCriterion,
  handleDeleteCriterion,
  handleStartEditCriterion,
  handleCancelEditCriterion,

  levelLabel,
  setLevelLabel,
  levelMinScore,
  setLevelMinScore,
  levelMaxScore,
  setLevelMaxScore,
  levelDesc,
  setLevelDesc,
  handleAddGradingLevel,
  handleRemoveGradingLevel,

  handleCreateRubric,
  setRubric,
  setCriteria,
}: RoundsTabProps) {
  // Read unused props to satisfy the TS compiler (noUnusedLocals: true)
  if (false as boolean) {
    console.log(setSelectedTrack, setRubric, setCriteria);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Column 1: Rounds list & create form */}
      <div className="lg:col-span-1 glass p-6 rounded-2xl flex flex-col justify-between">
        <div>
          <h3 className="text-md font-bold text-white mb-4 flex items-center gap-1.5 font-mono">
            <ListOrdered size={16} className="text-indigo-400" />
            <span>Các Vòng thi (Sự kiện)</span>
          </h3>
          <div className="space-y-2 mb-6 max-h-48 overflow-y-auto pr-1">
            {rounds.map((r: any) => (
              <button
                key={r._id}
                onClick={() => {
                  setSelectedRubricRoundId(r._id);
                }}
                className={`w-full text-left p-3 rounded-xl border text-xs flex justify-between items-center transition-all ${
                  selectedRubricRoundId === r._id
                    ? "bg-indigo-600/10 border-indigo-500/50 text-white font-bold"
                    : "border-slate-800/80 bg-slate-900/10 hover:border-slate-700 text-slate-400"
                }`}
              >
                <div>
                  <p>{r.name}</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">
                    Thứ tự: {r.order} | Lấy Top: {r.advanceTopN}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {tracks
                      .filter((t: any) => t.roundId === r._id)
                      .map((t: any) => (
                        <span
                          key={t._id}
                          className="bg-slate-950 px-1.5 py-0.5 rounded text-[8px] border border-slate-800 text-slate-450 font-sans"
                        >
                          {t.name}
                        </span>
                      ))}
                  </div>
                </div>
                <ChevronRight size={14} />
              </button>
            ))}
            {rounds.length === 0 && (
              <p className="text-xs text-slate-500 italic">
                Chưa cấu hình vòng thi nào cho sự kiện này.
              </p>
            )}
          </div>
        </div>

        {/* Quick create round form */}
        <form
          onSubmit={handleCreateRound}
          className="space-y-3 pt-3 border-t border-slate-800/80"
        >
          <p className="text-[10px] font-bold text-slate-300 uppercase font-mono">
            Tạo thêm vòng thi mới:
          </p>
          <input
            type="text"
            required
            placeholder="Tên vòng (e.g. Bán kết)"
            value={roundName}
            onChange={(e) => setRoundName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-xs font-mono"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              required
              placeholder="Thứ tự (e.g. 2)"
              value={roundOrder}
              onChange={(e) => setRoundOrder(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs font-mono"
            />
            <input
              type="number"
              required
              placeholder="Lấy Top N (e.g. 5)"
              value={roundLimit}
              onChange={(e) => setRoundLimit(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs font-mono"
            />
          </div>
          <input
            type="datetime-local"
            required
            value={roundDeadline}
            onChange={(e) => setRoundDeadline(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-xs font-mono"
          />

          {/* Rubric Configuration */}
          {selectedTrack ? (
            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 space-y-2">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                Bảng tiêu chí (Rubric) cho bảng {selectedTrack.name}:
              </p>
              <div className="flex gap-4">
                <label className="flex items-center gap-1 text-[10px] font-semibold text-slate-300 font-mono cursor-pointer">
                  <input
                    type="radio"
                    name="roundRubricOption"
                    value="new"
                    checked={rubricTypeOption === "new"}
                    onChange={() => setRubricTypeOption("new")}
                    className="text-indigo-600 focus:ring-0"
                  />
                  Mới
                </label>
                <label className="flex items-center gap-1 text-[10px] font-semibold text-slate-300 font-mono cursor-pointer">
                  <input
                    type="radio"
                    name="roundRubricOption"
                    value="existing"
                    checked={rubricTypeOption === "existing"}
                    onChange={() => setRubricTypeOption("existing")}
                    className="text-indigo-600 focus:ring-0"
                  />
                  Sao chép cũ
                </label>
              </div>

              {rubricTypeOption === "existing" && (
                <select
                  value={selectedSourceRubricId}
                  onChange={(e) => setSelectedSourceRubricId(e.target.value)}
                  className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-mono"
                >
                  <option value="">-- Chọn Rubric cũ --</option>
                  {existingRubrics.map((r: any) => (
                    <option key={r._id} value={r._id}>
                      {r.name} ({r.eventId?.name || "Sự kiện cũ"})
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <p className="text-[9px] text-amber-500 italic font-mono">
              * Cần chọn Bảng đấu trước để thiết lập Rubric.
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 rounded-lg cursor-pointer font-mono"
          >
            + Thêm Vòng Đấu & Rubric
          </button>
        </form>
      </div>

      {/* Column 2: Rubric & Criteria setup */}
      <div className="lg:col-span-2 glass p-6 rounded-2xl space-y-4">
        <h3 className="text-md font-bold text-white mb-4 flex items-center gap-1.5 font-mono">
          <Award size={18} className="text-indigo-400" />
          <span>Cấu hình Rubric & Tiêu chí</span>
        </h3>

        {/* Round Selector */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
            Chọn Vòng đấu
          </label>
          <select
            value={selectedRubricRoundId}
            onChange={(e) => setSelectedRubricRoundId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-xs bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
          >
            <option value="">-- Chọn Vòng đấu --</option>
            {rounds.map((r: any) => (
              <option key={r._id} value={r._id}>
                {r.name} (Vòng {r.order})
              </option>
            ))}
          </select>
        </div>

        {selectedRubricRoundId ? (
          rubric ? (
            editingRubric ? (
              /* Edit Rubric Form */
              <form
                onSubmit={handleUpdateRubric}
                className="space-y-3.5 bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 font-mono"
              >
                <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Chỉnh sửa Rubric
                </p>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Tên Rubric
                  </label>
                  <input
                    type="text"
                    required
                    value={editRubricName}
                    onChange={(e) => setEditRubricName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Mô tả
                  </label>
                  <textarea
                    value={editRubricDesc}
                    onChange={(e) => setEditRubricDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Điểm tối đa / Tiêu chí
                  </label>
                  <input
                    type="number"
                    required
                    value={editRubricMaxScore}
                    onChange={(e) => setEditRubricMaxScore(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editRubricIsActive}
                    onChange={(e) => setEditRubricIsActive(e.target.checked)}
                    id="edit-rubric-active"
                  />
                  <label
                    htmlFor="edit-rubric-active"
                    className="text-xs text-slate-300"
                  >
                    Hoạt động
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 rounded-lg text-xs cursor-pointer"
                  >
                    Lưu
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingRubric(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded-lg text-xs cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            ) : (
              /* Display Rubric Details & Criteria */
              <div className="space-y-4 font-mono">
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-xs flex justify-between items-center">
                  <div>
                    <p className="font-bold text-indigo-400">{rubric.name}</p>
                    {rubric.description && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {rubric.description}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">
                      Trọng số: {rubric.totalWeight}% | Max điểm:{" "}
                      {rubric.maxCriterionScore}đ
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    {rubric.isLocked ? (
                      <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded text-[10px] font-bold font-mono">
                        <Lock size={10} /> ĐÃ KHÓA
                      </span>
                    ) : (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditRubricName(rubric.name);
                            setEditRubricDesc(rubric.description || "");
                            setEditRubricTotalWeight(
                              String(rubric.totalWeight),
                            );
                            setEditRubricMaxScore(
                              String(rubric.maxCriterionScore),
                            );
                            setEditRubricIsActive(rubric.isActive);
                            setEditingRubric(true);
                          }}
                          className="bg-slate-850 hover:bg-slate-800 border border-indigo-500/20 text-[9px] font-bold px-2 py-0.5 rounded text-indigo-450 cursor-pointer"
                        >
                          SỬA
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteRubric}
                          className="bg-slate-850 hover:bg-slate-800 border border-rose-500/20 text-[9px] font-bold px-2 py-0.5 rounded text-rose-450 cursor-pointer"
                        >
                          XÓA
                        </button>
                      </div>
                    )}

                    {!rubric.isLocked && (
                      <button
                        onClick={handleLockRubric}
                        className="bg-indigo-600 hover:bg-indigo-500 text-[9px] font-bold px-2.5 py-1 rounded text-white cursor-pointer"
                      >
                        KHÓA RUBRIC
                      </button>
                    )}
                  </div>
                </div>

                {/* Weight progress bar */}
                {(() => {
                  const currentWeightSum = criteria.reduce(
                    (sum, c) => sum + (c.weight || 0),
                    0,
                  );
                  const isFullyWeighted =
                    Math.abs(currentWeightSum - rubric.totalWeight) < 0.01;
                  return (
                    <div className="bg-slate-900/30 p-3.5 rounded-xl border border-slate-800 text-[10px] space-y-1.5">
                      <div className="flex justify-between items-center font-semibold font-mono">
                        <span className="text-slate-400">
                          Trọng số tiêu chí đã phân bổ:
                        </span>
                        <span
                          className={
                            isFullyWeighted
                              ? "text-emerald-400 font-bold"
                              : "text-amber-400 font-bold"
                          }
                        >
                          {currentWeightSum} / {rubric.totalWeight}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-900">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isFullyWeighted ? "bg-emerald-500" : "bg-indigo-500"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              (currentWeightSum / rubric.totalWeight) * 100,
                            )}%`,
                          }}
                        ></div>
                      </div>
                      {!isFullyWeighted && !rubric.isLocked && (
                        <p className="text-[9px] text-amber-500/80 italic font-mono">
                          * Tổng trọng số tiêu chí phải bằng{" "}
                          {rubric.totalWeight}% mới có thể khoá Rubric.
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Criteria list */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-300">
                    Tiêu chí chi tiết:
                  </p>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {criteria.map((c: any) => (
                      <div
                        key={c._id}
                        className="bg-slate-900/30 p-3 rounded-xl border border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-slate-200">
                              [{c.code}] {c.name}
                            </span>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {c.description || "Không mô tả."}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-indigo-400 font-bold">
                              {c.weight}%
                            </span>
                            <p className="text-[9px] text-slate-500 mt-0.5">
                              Max: {c.maxScore}đ | Hạng: {c.order || 0}
                            </p>
                          </div>
                        </div>

                        {c.gradingLevels && c.gradingLevels.length > 0 && (
                          <div className="pt-1.5 border-t border-slate-850">
                            <div className="flex flex-wrap gap-1">
                              {c.gradingLevels.map((lvl: any, idx: number) => (
                                <span
                                  key={idx}
                                  className="bg-slate-950 px-2 py-0.5 rounded text-[8px] border border-slate-850 text-slate-400"
                                  title={lvl.description}
                                >
                                  <strong className="text-indigo-300">
                                    {lvl.label}
                                  </strong>{" "}
                                  ({lvl.minScore}-{lvl.maxScore}đ)
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {!rubric.isLocked && (
                          <div className="flex gap-2 justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditCriterion(c)}
                              className="text-[9px] text-indigo-400 hover:underline font-semibold cursor-pointer"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCriterion(c._id)}
                              className="text-[9px] text-rose-400 hover:underline font-semibold cursor-pointer"
                            >
                              Xóa
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {criteria.length === 0 && (
                      <p className="text-xs text-slate-500 italic">
                        Chưa có tiêu chí nào.
                      </p>
                    )}
                  </div>
                </div>

                {/* Add/Edit Criterion Form */}
                {!rubric.isLocked && (
                  <form
                    onSubmit={handleSaveCriterion}
                    className="space-y-3 pt-3 border-t border-slate-800"
                  >
                    <p className="text-xs font-bold text-slate-350">
                      {editingCriterion
                        ? `Sửa tiêu chí [${editingCriterion.code}]`
                        : "Thêm tiêu chí mới"}
                    </p>

                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="MÃ (e.g. CODE)"
                        value={critCode}
                        onChange={(e) => setCritCode(e.target.value)}
                        className="w-full px-2 py-1.5 rounded text-xs bg-slate-900 border border-slate-800 text-slate-200"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Tên tiêu chí (e.g. Clean Code)"
                        value={critName}
                        onChange={(e) => setCritName(e.target.value)}
                        className="w-full px-2 py-1.5 rounded text-xs col-span-2 bg-slate-900 border border-slate-800 text-slate-200"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        required
                        placeholder="Trọng số %"
                        value={critWeight}
                        onChange={(e) => setCritWeight(e.target.value)}
                        className="w-full px-2 py-1.5 rounded text-xs bg-slate-900 border border-slate-800 text-slate-200"
                      />
                      <input
                        type="number"
                        required
                        placeholder="Max Điểm"
                        value={critMaxScore}
                        onChange={(e) => setCritMaxScore(e.target.value)}
                        className="w-full px-2 py-1.5 rounded text-xs bg-slate-900 border border-slate-800 text-slate-200"
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="Mô tả tiêu chí"
                      value={critDesc}
                      onChange={(e) => setCritDesc(e.target.value)}
                      className="w-full px-3 py-1.5 rounded text-xs bg-slate-900 border border-slate-800 text-slate-200"
                    />

                    {/* Grading Levels Management in Form */}
                    <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-900 space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Định nghĩa mức chấm (Grading Levels)
                      </p>

                      {/* Display currently added levels in form */}
                      {critGradingLevels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {critGradingLevels.map((lvl, idx) => (
                            <div
                              key={idx}
                              className="bg-slate-900 border border-slate-800 text-[9px] px-2 py-0.5 rounded-md flex items-center gap-1.5"
                            >
                              <span className="text-slate-300">
                                <strong className="text-indigo-400">
                                  {lvl.label}
                                </strong>{" "}
                                ({lvl.minScore}-{lvl.maxScore}đ)
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveGradingLevel(idx)}
                                className="text-rose-400 font-bold hover:text-rose-350"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Form inputs for new level */}
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Nhãn (Tốt)"
                          value={levelLabel}
                          onChange={(e) => setLevelLabel(e.target.value)}
                          className="w-full px-2 py-1 rounded text-[10px] bg-slate-900 border border-slate-800 text-slate-200"
                        />
                        <input
                          type="number"
                          step="0.1"
                          placeholder="Điểm min (7.0)"
                          value={levelMinScore}
                          onChange={(e) => setLevelMinScore(e.target.value)}
                          className="w-full px-2 py-1 rounded text-[10px] bg-slate-900 border border-slate-800 text-slate-200"
                        />
                        <input
                          type="number"
                          step="0.1"
                          placeholder="Điểm max (8.5)"
                          value={levelMaxScore}
                          onChange={(e) => setLevelMaxScore(e.target.value)}
                          className="w-full px-2 py-1 rounded text-[10px] bg-slate-900 border border-slate-800 text-slate-200"
                        />
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Mô tả chi tiết mức chấm này..."
                          value={levelDesc}
                          onChange={(e) => setLevelDesc(e.target.value)}
                          className="flex-1 px-2 py-1 rounded text-[10px] bg-slate-900 border border-slate-800 text-slate-200"
                        />
                        <button
                          type="button"
                          onClick={handleAddGradingLevel}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded text-[10px] font-bold cursor-pointer"
                        >
                          + Thêm
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 rounded-lg cursor-pointer"
                      >
                        {editingCriterion ? "Lưu cập nhật" : "Lưu tiêu chí"}
                      </button>
                      {editingCriterion && (
                        <button
                          type="button"
                          onClick={handleCancelEditCriterion}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 px-4 rounded-lg cursor-pointer"
                        >
                          Hủy sửa
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            )
          ) : (
            /* Initial Rubric creation form if no rubric exists */
            <form onSubmit={handleCreateRubric} className="space-y-3 font-mono">
              <p className="text-xs text-slate-400">
                Chưa khởi tạo Rubric cho Vòng Đấu này.
              </p>
              <input
                type="text"
                required
                placeholder="Tên Rubric (e.g. Rubric Đánh giá Vòng 1)"
                value={rubricName}
                onChange={(e) => setRubricName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs bg-slate-900 border border-slate-800 text-slate-200"
              />
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 rounded-lg cursor-pointer"
              >
                Khởi tạo Rubric
              </button>
            </form>
          )
        ) : (
          <p className="text-xs text-slate-500 italic text-center py-4 font-mono">
            Vui lòng chọn Vòng Đấu để cấu hình Rubric.
          </p>
        )}
      </div>
    </div>
  );
}
