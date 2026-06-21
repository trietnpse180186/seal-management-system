import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  CalendarPlus,
  Info,
  Calendar,
  Clock,
} from "lucide-react";
import TeamsTab from "./TeamsTab";
import TracksTab from "./TracksTab";
import RoundsTab from "./RoundsTab";
import GithubTab from "../teams/GithubTab";
import { toast } from "sonner";
import { useConfirm } from "../shared/ConfirmDialog";
import CustomSelect from "../shared/CustomSelect";
import CustomDateTimePicker from "../shared/CustomDateTimePicker";

const Github = ({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) => (
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

interface AdminEventsProps {
  defaultTab?: "events";
}

export default function AdminEvents({
  defaultTab = "events",
}: AdminEventsProps) {
  const token = localStorage.getItem("token");
  const [searchParams, setSearchParams] = useSearchParams();
  const confirm = useConfirm();

  const eventIdParam = searchParams.get("eventId");
  const [eventName, setEventName] = useState("");
  const [semester, setSemester] = useState("Spring");
  const [year, setYear] = useState("2026");
  const [desc, setDesc] = useState("");
  const [maxTeams, setMaxTeams] = useState("10");

  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const [tracks, setTracks] = useState<any[]>([]);
  const [trackName, setTrackName] = useState("");
  const [trackDesc, setTrackDesc] = useState("");
  const [trackMax, setTrackMax] = useState("5");
  const [trackRoundId, setTrackRoundId] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [editingTrack, setEditingTrack] = useState<any>(null);

  const [rounds, setRounds] = useState<any[]>([]);
  const [roundName, setRoundName] = useState("");
  const [roundOrder, setRoundOrder] = useState("1");
  const [roundDeadline, setRoundDeadline] = useState("");
  const [roundLimit, setRoundLimit] = useState("3");

  const [rubricTypeOption, setRubricTypeOption] = useState<"new" | "existing">(
    "new",
  );
  const [existingRubrics, setExistingRubrics] = useState<any[]>([]);
  const [selectedSourceRubricId, setSelectedSourceRubricId] = useState("");

  const [rubricName, setRubricName] = useState("");
  const [rubric, setRubric] = useState<any>(null);
  const [criteria, setCriteria] = useState<any[]>([]);

  const [critCode, setCritCode] = useState("");
  const [critName, setCritName] = useState("");
  const [critWeight, setCritWeight] = useState("20");
  const [critDesc, setCritDesc] = useState("");

  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");

  const [eventRoles, setEventRoles] = useState<any[]>([]);
  const [teamsList, setTeamsList] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const setMessage = (msg: { type: string; text: string }) => {
    if (msg.text) {
      if (msg.type === "success") {
        toast.success(msg.text);
      } else if (msg.type === "error") {
        toast.error(msg.text);
      }
    }
  };

  // Tab management state
  const [activeTab, setActiveTab] = useState<
    "admin" | "events" | "teams" | "rounds" | "tracks" | "github" | "logs" | "schedule"
  >(defaultTab);
  const [eventLogs, setEventLogs] = useState<any[]>([]);
  // Sidebar collapse state (for premium slide effect)
  // const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Edit Event States
  const [editEventName, setEditEventName] = useState("");
  const [editEventSemester, setEditEventSemester] = useState("Spring");
  const [editEventYear, setEditEventYear] = useState("2026");
  const [editEventDesc, setEditEventDesc] = useState("");
  const [editEventMaxTeams, setEditEventMaxTeams] = useState("10");
  const [editEventGithubOrgName, setEditEventGithubOrgName] = useState("");
  const [editEventRegOpen, setEditEventRegOpen] = useState("");
  const [editEventRegClose, setEditEventRegClose] = useState("");
  const [editEventContestStart, setEditEventContestStart] = useState("");
  const [editEventContestEnd, setEditEventContestEnd] = useState("");

  // Track Schedule States
  const [selectedTrackForSchedule, setSelectedTrackForSchedule] = useState<any>(null);
  const [trackStartTime, setTrackStartTime] = useState("");
  const [trackEndTime, setTrackEndTime] = useState("");
  const [trackGradingEndTime, setTrackGradingEndTime] = useState("");

  // Rubric Edit Form States
  const [selectedRubricRoundId, setSelectedRubricRoundId] = useState("");
  const [editingRubric, setEditingRubric] = useState(false);
  const [editRubricName, setEditRubricName] = useState("");
  const [editRubricDesc, setEditRubricDesc] = useState("");
  const [editRubricTotalWeight, setEditRubricTotalWeight] = useState("100");
  const [editRubricMaxScore, setEditRubricMaxScore] = useState("10");
  const [editRubricIsActive, setEditRubricIsActive] = useState(true);

  // Criterion States (Advanced)
  const [critMaxScore, setCritMaxScore] = useState("10");
  const [critOrder, setCritOrder] = useState("1");
  const [critGradingLevels, setCritGradingLevels] = useState<any[]>([]);
  const [editingCriterion, setEditingCriterion] = useState<any>(null);

  // Grading Level Form States
  const [levelLabel, setLevelLabel] = useState("");
  const [levelMinScore, setLevelMinScore] = useState("");
  const [levelMaxScore, setLevelMaxScore] = useState("");
  const [levelDesc, setLevelDesc] = useState("");

  // GitHub integration states
  const [githubOrgName, setGithubOrgName] = useState("seal-hackathon-2026");
  const [repos, setRepos] = useState<any[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [linkingTeamId, setLinkingTeamId] = useState("");
  const [manualRepoName, setManualRepoName] = useState("");
  const [manualRepoUrl, setManualRepoUrl] = useState("");
  const [syncingRepoId, setSyncingRepoId] = useState("");

  const formatForDateTimeLocal = (dateString: string | null | undefined) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const populateEventSchedule = (eventObj: any) => {
    setEditEventRegOpen(formatForDateTimeLocal(eventObj.registrationOpen));
    setEditEventRegClose(formatForDateTimeLocal(eventObj.registrationClose));
    setEditEventContestStart(formatForDateTimeLocal(eventObj.contestStart));
    setEditEventContestEnd(formatForDateTimeLocal(eventObj.contestEnd));
  };

  const handleSelectTrackForSchedule = (trackObj: any) => {
    setSelectedTrackForSchedule(trackObj);
    if (trackObj) {
      setTrackStartTime(formatForDateTimeLocal(trackObj.startTime));
      setTrackEndTime(formatForDateTimeLocal(trackObj.endTime));
      setTrackGradingEndTime(formatForDateTimeLocal(trackObj.gradingEndTime));
    } else {
      setTrackStartTime("");
      setTrackEndTime("");
      setTrackGradingEndTime("");
    }
  };

  const handleSaveEventSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const res = await axios.put(
        `http://localhost:5000/api/events/${selectedEvent._id}`,
        {
          registrationOpen: editEventRegOpen || null,
          registrationClose: editEventRegClose || null,
          contestStart: editEventContestStart || null,
          contestEnd: editEventContestEnd || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSelectedEvent(res.data.event);
      toast.success("Đã cập nhật lịch trình sự kiện thành công!");
      setMessage({ type: "success", text: "Đã cập nhật lịch trình sự kiện thành công!" });
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Lỗi khi cập nhật lịch trình sự kiện.");
      setMessage({ type: "error", text: err.response?.data?.message || "Lỗi khi cập nhật lịch trình sự kiện." });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTrackSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !selectedTrackForSchedule) return;
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const res = await axios.put(
        `http://localhost:5000/api/events/${selectedEvent._id}/tracks/${selectedTrackForSchedule._id}`,
        {
          startTime: trackStartTime || null,
          endTime: trackEndTime || null,
          gradingEndTime: trackGradingEndTime || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update track in tracks list
      setTracks(prev => prev.map(t => t._id === res.data._id ? res.data : t));
      setSelectedTrackForSchedule(res.data);
      toast.success("Đã cập nhật lịch trình bảng đấu thành công!");
      setMessage({ type: "success", text: "Đã cập nhật lịch trình bảng đấu thành công!" });
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Lỗi khi cập nhật lịch trình bảng đấu.");
      setMessage({ type: "error", text: err.response?.data?.message || "Lỗi khi cập nhật lịch trình bảng đấu." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchExistingRubrics();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      fetchEventDetails();
    }
  }, [selectedEvent]);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (activeTab === "logs" && selectedEvent) {
      fetchEventLogs();
      const interval = setInterval(() => {
        fetchEventLogs();
      }, 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    }
  }, [activeTab, selectedEvent]);

  useEffect(() => {
    if (eventIdParam) {
      const foundEvent = events.find((e) => e._id === eventIdParam);
      if (foundEvent) {
        setSelectedEvent(foundEvent);
        setEditEventName(foundEvent.name || "");
        setEditEventSemester(foundEvent.semester || "Spring");
        setEditEventYear(String(foundEvent.year || 2026));
        setEditEventDesc(foundEvent.description || "");
        setEditEventMaxTeams(String(foundEvent.maxTeams || 10));
        setEditEventGithubOrgName(foundEvent.githubOrgName || "");
        populateEventSchedule(foundEvent);
      } else if (events.length > 0) {
        setSelectedEvent(null);
      }
    } else {
      setSelectedEvent(null);
    }
  }, [eventIdParam, events]);

  const fetchEvents = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/events");
      setEvents(res.data);
    } catch (err) {
      console.error("Lỗi lấy danh sách sự kiện:", err);
    }
  };

  const fetchExistingRubrics = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/rubrics", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setExistingRubrics(res.data);
    } catch (err) {
      console.error("Lỗi lấy danh sách rubric cũ:", err);
    }
  };

  const fetchRepositories = async (eventId: string) => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/github-repositories?eventId=${eventId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setRepos(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAllTeams = async (eventId: string) => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/teams/all/${eventId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setAllTeams(res.data.filter((t: any) => t.status === "confirmed"));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEventDetails = async () => {
    if (!selectedEvent) return;
    try {
      const res = await axios.get(
        `http://localhost:5000/api/events/${selectedEvent._id}`,
      );
      setTracks(res.data.tracks || []);
      setRounds(res.data.rounds || []);

      if (res.data.tracks && res.data.tracks.length > 0 && !selectedTrack) {
        setSelectedTrack(res.data.tracks[0]);
      }
      if (res.data.tracks && res.data.tracks.length > 0 && !selectedTrack) {
        setSelectedTrack(res.data.tracks[0]);
      }

      if (res.data.event) {
        populateEventSchedule(res.data.event);
      }

      if (res.data.tracks && res.data.tracks.length > 0) {
        if (selectedTrackForSchedule) {
          const updatedTrack = res.data.tracks.find((t: any) => t._id === selectedTrackForSchedule._id);
          if (updatedTrack) {
            setSelectedTrackForSchedule(updatedTrack);
          }
        } else {
          handleSelectTrackForSchedule(res.data.tracks[0]);
        }
      }

      fetchEventRoles();
      fetchTeamsList();
      fetchRepositories(selectedEvent._id);
      fetchAllTeams(selectedEvent._id);
      fetchEventLogs();
    } catch (err) {
      console.error("Lỗi fetch chi tiết sự kiện:", err);
    }
  };

  const fetchEventLogs = async () => {
    if (!selectedEvent) return;
    try {
      const res = await axios.get(
        `http://localhost:5000/api/events/${selectedEvent._id}/logs`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setEventLogs(res.data || []);
    } catch (err) {
      console.error("Lỗi lấy nhật ký sự kiện:", err);
    }
  };

  const fetchEventRoles = async () => {
    if (!selectedEvent) return;
    try {
      const res = await axios.get(
        `http://localhost:5000/api/events/${selectedEvent._id}/roles`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setEventRoles(res.data || []);
    } catch (err) {
      console.error("Lỗi lấy danh sách quyền thành viên:", err);
    }
  };

  const fetchTeamsList = async () => {
    if (!selectedEvent) return;
    try {
      const res = await axios.get(
        `http://localhost:5000/api/teams/all/${selectedEvent._id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setTeamsList(res.data || []);
    } catch (err) {
      console.error("Lỗi lấy danh sách đội thi:", err);
    }
  };

  const handleDistributeTeams = async () => {
    if (!selectedEvent) return;
    if (tracks.length === 0) {
      setMessage({
        type: "error",
        text: "Vui lòng khởi tạo ít nhất một bảng đấu (Track) trước.",
      });
      return;
    }

    const unassignedTeams = teamsList.filter(
      (t) => t.status === "confirmed" && !t.trackId,
    );
    if (unassignedTeams.length === 0) {
      setMessage({
        type: "error",
        text: "Không tìm thấy đội thi đã xác nhận nào chưa được chia bảng đấu.",
      });
      return;
    }

    const confirmed = await confirm({
      title: "Phân chia bảng đấu ngẫu nhiên",
      message: `Bạn có chắc chắn muốn phân chia ngẫu nhiên ${unassignedTeams.length} đội thi vào ${tracks.length} bảng đấu? Hệ thống sẽ tự động tạo repository GitHub cho các đội.`,
    });
    if (!confirmed) {
      return;
    }

    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.post(
        `http://localhost:5000/api/events/${selectedEvent._id}/distribute-teams`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMessage({
        type: "success",
        text: res.data.message || "Phân chia bảng đấu ngẫu nhiên thành công!",
      });
      fetchEventDetails();
    } catch (err: any) {
      setMessage({
        type: "error",
        text:
          err.response?.data?.message || "Lỗi khi chia bảng đấu ngẫu nhiên.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTrack = async (teamId: string, trackId: string) => {
    if (!selectedEvent) return;
    if (trackId === "random" && tracks.length === 0) {
      setMessage({
        type: "error",
        text: "Vui lòng khởi tạo ít nhất một bảng đấu (Track) trước.",
      });
      return;
    }

    if (trackId === "random") {
      const confirmed = await confirm({
        title: "Phân chia bảng đấu ngẫu nhiên",
        message: "Bạn có chắc muốn phân bảng đấu ngẫu nhiên cho đội thi này?",
      });
      if (!confirmed) {
        return;
      }
    }

    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.put(
        `http://localhost:5000/api/teams/${teamId}/assign-track`,
        { trackId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMessage({
        type: "success",
        text: res.data.message || "Phân bảng đấu thành công!",
      });
      fetchEventDetails();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi phân bảng đấu.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKickAllCollaborators = async (repoId: string) => {
    if (
      !window.confirm(
        "Bạn có chắc chắn muốn thu hồi quyền truy cập (gỡ cộng tác viên) của toàn bộ thành viên nhóm và mentor khỏi repository này không?"
      )
    ) {
      return;
    }
    setLoading(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await axios.post(
        `http://localhost:5000/api/github-repositories/${repoId}/kick-all`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setMessage({
        type: "success",
        text: res.data.message || "Thu hồi quyền thành công!",
      });
      if (selectedEvent) {
        fetchRepositories(selectedEvent._id);
      }
    } catch (err: any) {
      console.error("Kick all collaborators error:", err);
      setMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          "Lỗi khi thu hồi quyền truy cập repository.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEvent = (eventObj: any) => {
    setSelectedEvent(eventObj);
    setSelectedTrack(null);

    setRubric(null);
    setCriteria([]);
    setMessage({ type: "", text: "" });

    // Populate edit fields for the event
    setEditEventName(eventObj.name || "");
    setEditEventSemester(eventObj.semester || "Spring");
    setEditEventYear(String(eventObj.year || 2026));
    setEditEventDesc(eventObj.description || "");
    setEditEventMaxTeams(String(eventObj.maxTeams || 10));
    setEditEventGithubOrgName(eventObj.githubOrgName || "");
    populateEventSchedule(eventObj);

    // If we are currently on the 'events' tab/route, sync URL
    if (defaultTab === "events") {
      setSearchParams({ eventId: eventObj._id });
    }

    // Fetch roles immediately when choosing existing event
    axios
      .get(`http://localhost:5000/api/events/${eventObj._id}/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setEventRoles(res.data || []))
      .catch(console.error);
  };



  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.post(
        "http://localhost:5000/api/events",
        {
          name: eventName,
          semester,
          year: parseInt(year),
          description: desc,
          maxTeams: parseInt(maxTeams),
          githubOrgName,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const newEvent = res.data.event;
      setSelectedEvent(newEvent);
      setTracks([]);
      setRounds([]);
      setSelectedTrack(null);

      setEventName("");
      setDesc("");
      setGithubOrgName("seal-hackathon-2026");
      setMessage({
        type: "success",
        text: "Khởi tạo Cuộc thi thành công! Chi tiết cuộc thi hiển thị bên dưới.",
      });

      fetchEvents();
      setActiveTab("admin"); // Go to admin tab to view it
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi tạo cuộc thi.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.put(
        `http://localhost:5000/api/events/${selectedEvent._id}`,
        {
          name: editEventName,
          semester: editEventSemester,
          year: parseInt(editEventYear),
          description: editEventDesc,
          maxTeams: parseInt(editEventMaxTeams),
          githubOrgName: editEventGithubOrgName,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMessage({ type: "success", text: "Cập nhật sự kiện thành công!" });
      setSelectedEvent(res.data.event);
      fetchEvents();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi cập nhật sự kiện.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEventStatus = async (newStatus: string) => {
    if (!selectedEvent) return;
    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.put(
        `http://localhost:5000/api/events/${selectedEvent._id}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMessage({
        type: "success",
        text: "Cập nhật trạng thái cuộc thi thành công!",
      });
      setSelectedEvent(res.data.event);
      fetchEvents();
    } catch (err: any) {
      setMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          "Lỗi khi cập nhật trạng thái cuộc thi.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    if (!trackRoundId) {
      setMessage({
        type: "error",
        text: "Vui lòng chọn Vòng thi cho Bảng đấu.",
      });
      return;
    }

    const selectedRound = rounds.find((r) => r._id === trackRoundId);
    if (selectedRound && selectedRound.status === 'completed') {
      setMessage({ type: "error", text: "Không thể tạo bảng đấu mới cho vòng thi đã kết thúc." });
      return;
    }

    // Client-side validation: total maxTeams check
    const totalAllocatedTeams = tracks.reduce((sum, t) => sum + (t.maxTeams || 0), 0);
    const maxEventTeams = selectedEvent.maxTeams || 0;
    const newMaxTeamsNum = parseInt(trackMax) || 0;
    if (totalAllocatedTeams + newMaxTeamsNum > maxEventTeams) {
      setMessage({
        type: "error",
        text: `Không thể tạo bảng đấu. Tổng số lượng đội tối đa của các bảng đấu (${totalAllocatedTeams + newMaxTeamsNum}) vượt quá số lượng đội giới hạn của cuộc thi (${maxEventTeams}).`,
      });
      return;
    }

    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.post(
        `http://localhost:5000/api/events/${selectedEvent._id}/tracks`,
        {
          name: trackName,
          description: trackDesc,
          maxTeams: newMaxTeamsNum,
          roundId: trackRoundId,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const newTrack = res.data;
      setTrackName("");
      setTrackDesc("");
      setTrackRoundId("");
      setTrackMax("");

      // Update local tracks state
      const updatedTracks = [...tracks, newTrack];
      setTracks(updatedTracks);
      setSelectedTrack(newTrack);

      // Fetch updated event details to reload tracks with round mapping
      await fetchEventDetails();

      setMessage({ type: "success", text: "Thêm bảng đấu thành công!" });
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi thêm bảng đấu.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !editingTrack) return;
    if (!trackRoundId) {
      setMessage({
        type: "error",
        text: "Vui lòng chọn Vòng thi cho Bảng đấu.",
      });
      return;
    }

    const selectedRound = rounds.find((r) => r._id === trackRoundId);
    if (selectedRound && selectedRound.status === 'completed') {
      setMessage({ type: "error", text: "Không thể chỉnh sửa bảng đấu của vòng thi đã kết thúc." });
      return;
    }

    // Client-side validation for max teams limit
    const totalAllocatedTeams = tracks
      .filter((t) => t._id !== editingTrack._id)
      .reduce((sum, t) => sum + (t.maxTeams || 0), 0);
    const maxEventTeams = selectedEvent.maxTeams || 0;
    const updatedMaxTeamsNum = parseInt(trackMax) || 0;
    if (totalAllocatedTeams + updatedMaxTeamsNum > maxEventTeams) {
      setMessage({
        type: "error",
        text: `Không thể cập nhật bảng đấu. Tổng số lượng đội tối đa của các bảng đấu (${totalAllocatedTeams + updatedMaxTeamsNum}) vượt quá số lượng đội giới hạn của cuộc thi (${maxEventTeams}).`,
      });
      return;
    }

    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.put(
        `http://localhost:5000/api/events/${selectedEvent._id}/tracks/${editingTrack._id}`,
        {
          name: trackName,
          description: trackDesc,
          maxTeams: updatedMaxTeamsNum,
          roundId: trackRoundId,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const updatedTrack = res.data;
      setTrackName("");
      setTrackDesc("");
      setTrackRoundId("");
      setTrackMax("");
      setEditingTrack(null);

      // Update local tracks state
      setTracks(tracks.map((t) => (t._id === updatedTrack._id ? updatedTrack : t)));
      setSelectedTrack(updatedTrack);

      // Fetch updated event details to reload tracks with round mapping
      await fetchEventDetails();

      setMessage({ type: "success", text: "Cập nhật bảng đấu thành công!" });
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi cập nhật bảng đấu.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTrack = async (trackId: string) => {
    if (!selectedEvent) return;

    // Check if the round status of this track is completed
    const trackToDelete = tracks.find(t => t._id === trackId);
    if (trackToDelete) {
      const roundOfTrack = rounds.find(r => r._id === trackToDelete.roundId);
      if (roundOfTrack && roundOfTrack.status === 'completed') {
        setMessage({ type: "error", text: "Không thể xóa bảng đấu của vòng thi đã kết thúc." });
        return;
      }
    }

    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      await axios.delete(
        `http://localhost:5000/api/events/${selectedEvent._id}/tracks/${trackId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      // If we are currently editing the deleted track, reset edit state
      if (editingTrack?._id === trackId) {
        setTrackName("");
        setTrackDesc("");
        setTrackRoundId("");
        setTrackMax("");
        setEditingTrack(null);
      }

      // Update local tracks state
      const updatedTracks = tracks.filter((t) => t._id !== trackId);
      setTracks(updatedTracks);

      if (selectedTrack?._id === trackId) {
        setSelectedTrack(updatedTracks.length > 0 ? updatedTracks[0] : null);
      }

      setMessage({ type: "success", text: "Xóa bảng đấu thành công!" });
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi xóa bảng đấu.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      // 1. Create the Round
      const roundRes = await axios.post(
        `http://localhost:5000/api/events/${selectedEvent._id}/rounds`,
        {
          name: roundName,
          order: parseInt(roundOrder),
          submissionDeadline: roundDeadline || undefined,
          advanceTopN: parseInt(roundLimit),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const newRound = roundRes.data;

      // 2. Setup Rubric (Create empty or Clone) - unconditionally linked to Round
      if (rubricTypeOption === "existing" && selectedSourceRubricId) {
        // Clone rubric API
        await axios.post(
          "http://localhost:5000/api/rubrics/clone",
          {
            fromRubricId: selectedSourceRubricId,
            eventId: selectedEvent._id,
            roundId: newRound._id,
            name: `Rubric ${newRound.name}`,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setMessage({
          type: "success",
          text: `Tạo vòng đấu "${newRound.name}" và sao chép Rubric thành công!`,
        });
      } else {
        // Create empty Rubric
        await axios.post(
          "http://localhost:5000/api/rubrics",
          {
            eventId: selectedEvent._id,
            roundId: newRound._id,
            name: rubricName || `Rubric ${newRound.name}`,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setMessage({
          type: "success",
          text: `Tạo vòng đấu "${newRound.name}" và khởi tạo Rubric trống thành công!`,
        });
      }

      setRoundName("");
      setRoundOrder("1");
      setRoundLimit("3");
      setRoundDeadline("");
      setRubricName("");
      setSelectedSourceRubricId("");

      // Refresh event details
      await fetchEventDetails();

      // Auto select the new round to view rubric
      setSelectedRubricRoundId(newRound._id);

      // Re-fetch existing rubrics list
      fetchExistingRubrics();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi tạo vòng đấu.",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRoundsAndRubric = async () => {
    if (!selectedRubricRoundId) {
      setRubric(null);
      setCriteria([]);
      return;
    }
    try {
      const res = await axios.get(
        `http://localhost:5000/api/rubrics/round/${selectedRubricRoundId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setRubric(res.data.rubric);
      setCriteria(res.data.criteria || []);

      // Populate edit fields if rubric exists
      if (res.data.rubric) {
        setEditRubricName(res.data.rubric.name);
        setEditRubricDesc(res.data.rubric.description || "");
        setEditRubricTotalWeight(String(res.data.rubric.totalWeight || 100));
        setEditRubricMaxScore(String(res.data.rubric.maxCriterionScore || 10));
        setEditRubricIsActive(res.data.rubric.isActive);
      }
    } catch (err) {
      setRubric(null);
      setCriteria([]);
    }
  };

  useEffect(() => {
    fetchRoundsAndRubric();
  }, [selectedRubricRoundId]);

  useEffect(() => {
    // When selected track or rounds change, auto-select a round for rubric selection
    if (selectedTrack && rounds.length > 0) {
      const associatedRound = rounds.find(
        (r: any) => r._id === selectedTrack.roundId,
      );
      if (associatedRound) {
        setSelectedRubricRoundId(associatedRound._id);
      } else {
        setSelectedRubricRoundId("");
        setRubric(null);
        setCriteria([]);
      }
    } else {
      setSelectedRubricRoundId("");
      setRubric(null);
      setCriteria([]);
    }
  }, [selectedTrack, rounds]);

  const handleCreateRubric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !selectedTrack || !selectedRubricRoundId) return;

    try {
      await axios.post(
        "http://localhost:5000/api/rubrics",
        {
          eventId: selectedEvent._id,
          trackId: selectedTrack._id,
          roundId: selectedRubricRoundId,
          name: rubricName,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setRubricName("");
      setMessage({ type: "success", text: "Khởi tạo Rubric thành công!" });
      fetchRoundsAndRubric();
      fetchExistingRubrics();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi khởi tạo Rubric.",
      });
    }
  };

  const handleUpdateRubric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rubric) return;
    try {
      const res = await axios.put(
        `http://localhost:5000/api/rubrics/${rubric._id}`,
        {
          name: editRubricName,
          description: editRubricDesc,
          totalWeight: parseFloat(editRubricTotalWeight),
          maxCriterionScore: parseFloat(editRubricMaxScore),
          isActive: editRubricIsActive,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setRubric(res.data);
      setEditingRubric(false);
      setMessage({ type: "success", text: "Cập nhật Rubric thành công!" });
      fetchRoundsAndRubric();
      fetchExistingRubrics();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi cập nhật Rubric.",
      });
    }
  };

  const handleDeleteRubric = async () => {
    if (!rubric) return;
    const confirmed = await confirm({
      title: "Xóa Rubric",
      message: "Bạn có chắc chắn muốn xóa/vô hiệu hóa Rubric này?",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await axios.delete(`http://localhost:5000/api/rubrics/${rubric._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRubric(null);
      setCriteria([]);
      setMessage({ type: "success", text: "Đã xóa Rubric thành công." });
      fetchRoundsAndRubric();
      fetchExistingRubrics();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi xóa Rubric.",
      });
    }
  };

  const handleSaveCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rubric) return;

    const parsedWeight = parseFloat(critWeight);
    const parsedMaxScore = parseFloat(critMaxScore);
    const parsedOrder = parseInt(critOrder);

    if (isNaN(parsedWeight) || isNaN(parsedMaxScore)) {
      setMessage({
        type: "error",
        text: "Trọng số và điểm tối đa phải là số.",
      });
      return;
    }

    const payload: any = {
      code: critCode.trim().toUpperCase(),
      name: critName.trim(),
      description: critDesc.trim(),
      weight: parsedWeight,
      maxScore: parsedMaxScore,
      gradingLevels: critGradingLevels,
    };

    if (editingCriterion) {
      payload.order = isNaN(parsedOrder) ? undefined : parsedOrder;
    }

    try {
      if (editingCriterion) {
        await axios.put(
          `http://localhost:5000/api/criteria/${editingCriterion._id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setMessage({
          type: "success",
          text: "Cập nhật tiêu chí chấm điểm thành công!",
        });
      } else {
        await axios.post(
          `http://localhost:5000/api/criteria/rubric/${rubric._id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setMessage({
          type: "success",
          text: "Đã thêm tiêu chí chấm điểm mới!",
        });
      }

      setCritCode("");
      setCritName("");
      setCritDesc("");
      setCritWeight("20");
      setCritMaxScore("10");
      setCritOrder("1");
      setCritGradingLevels([]);
      setEditingCriterion(null);
      fetchRoundsAndRubric();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi lưu tiêu chí.",
      });
    }
  };

  const handleDeleteCriterion = async (criterionId: string) => {
    const confirmed = await confirm({
      title: "Xóa tiêu chí",
      message: "Bạn có chắc chắn muốn xóa tiêu chí này?",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await axios.delete(`http://localhost:5000/api/criteria/${criterionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage({ type: "success", text: "Đã xóa tiêu chí thành công." });
      fetchRoundsAndRubric();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi xóa tiêu chí.",
      });
    }
  };

  const handleStartEditCriterion = (c: any) => {
    setEditingCriterion(c);
    setCritCode(c.code);
    setCritName(c.name);
    setCritDesc(c.description || "");
    setCritWeight(String(c.weight));
    setCritMaxScore(String(c.maxScore || 10));
    setCritOrder(String(c.order || 1));
    setCritGradingLevels(c.gradingLevels || []);
  };

  const handleCancelEditCriterion = () => {
    setEditingCriterion(null);
    setCritCode("");
    setCritName("");
    setCritDesc("");
    setCritWeight("20");
    setCritMaxScore("10");
    setCritOrder("1");
    setCritGradingLevels([]);
  };

  const handleAddGradingLevel = () => {
    if (!levelLabel.trim() || levelMinScore === "" || levelMaxScore === "") {
      alert("Vui lòng điền nhãn, điểm tối thiểu và điểm tối đa.");
      return;
    }
    const min = parseFloat(levelMinScore);
    const max = parseFloat(levelMaxScore);
    if (isNaN(min) || isNaN(max)) {
      alert("Điểm số phải là số.");
      return;
    }
    if (min > max) {
      alert("Điểm tối thiểu không được lớn hơn điểm tối đa.");
      return;
    }

    const newLvl = {
      label: levelLabel.trim(),
      minScore: min,
      maxScore: max,
      description: levelDesc.trim(),
    };

    setCritGradingLevels((prev) => {
      const updated = [...prev, newLvl];
      return updated.sort((a, b) => a.minScore - b.minScore);
    });

    setLevelLabel("");
    setLevelMinScore("");
    setLevelMaxScore("");
    setLevelDesc("");
  };

  const handleRemoveGradingLevel = (index: number) => {
    setCritGradingLevels((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleLockRubric = async () => {
    if (!rubric) return;
    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.post(
        `http://localhost:5000/api/rubrics/${rubric._id}/lock`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setRubric(res.data.rubric);
      setMessage({
        type: "success",
        text: "Đã khóa Rubric thành công! Bảng điểm đã sẵn sàng sử dụng.",
      });
      fetchRoundsAndRubric();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khóa Rubric.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdvanceRound = async (roundId: string) => {
    if (!selectedEvent || !roundId) return;

    const confirmed = await confirm({
      title: "Chốt và thăng hạng vòng đấu",
      message: "Bạn có chắc chắn muốn CHỐT vòng đấu này và THĂNG HẠNG (Advance) các đội xuất sắc nhất vào vòng tiếp theo?",
      variant: "warning",
    });
    if (!confirmed) {
      return;
    }

    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.post(
        "http://localhost:5000/api/grades/advance-round",
        {
          eventId: selectedEvent._id,
          currentRoundId: roundId
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage({ type: "success", text: res.data.message });

      // Reload event details, rounds, and teams list
      await fetchEventDetails();
      await fetchTeamsList();
    } catch (err: any) {
      console.error(err);
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi chốt và thăng hạng vòng đấu."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLockRound = async (roundId: string) => {
    if (!selectedEvent || !roundId) return;

    const confirmed = await confirm({
      title: "Khóa điểm vòng đấu",
      message: "Bạn có chắc chắn muốn KHÓA điểm và CÔNG BỐ kết quả xếp hạng cho vòng đấu này? Sau khi khóa, giám khảo sẽ không thể sửa điểm được nữa.",
      variant: "warning",
    });
    if (!confirmed) {
      return;
    }

    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.post(
        "http://localhost:5000/api/grades/lock-round",
        {
          eventId: selectedEvent._id,
          roundId: roundId
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage({ type: "success", text: res.data.message });

      // Reload event details and rounds
      await fetchEventDetails();
      await fetchRoundsAndRubric();
    } catch (err: any) {
      console.error(err);
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi khóa điểm và công bố kết quả."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRepo = async (teamId: string) => {
    setMessage({ type: "", text: "" });
    try {
      const res = await axios.post(
        "http://localhost:5000/api/github-repositories/create",
        { teamId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMessage({ type: "success", text: res.data.message });
      if (selectedEvent) {
        fetchRepositories(selectedEvent._id);
        fetchAllTeams(selectedEvent._id);
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi tạo repository.",
      });
    }
  };

  const handleLinkRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingTeamId || !manualRepoName || !manualRepoUrl) return;
    setMessage({ type: "", text: "" });

    try {
      const res = await axios.post(
        "http://localhost:5000/api/github-repositories/link",
        {
          teamId: linkingTeamId,
          repoName: manualRepoName,
          repoUrl: manualRepoUrl,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMessage({ type: "success", text: res.data.message });
      setManualRepoName("");
      setManualRepoUrl("");
      setLinkingTeamId("");
      if (selectedEvent) {
        fetchRepositories(selectedEvent._id);
        fetchAllTeams(selectedEvent._id);
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi liên kết repository.",
      });
    }
  };

  const handleSyncRepo = async (repoId: string) => {
    setSyncingRepoId(repoId);
    setMessage({ type: "", text: "" });
    try {
      setMessage({
        type: "success",
        text: "Đang bắt đầu đồng bộ và chạy AI Review...",
      });
      const res = await axios.post(
        `http://localhost:5000/api/github-repositories/${repoId}/sync`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMessage({ type: "success", text: res.data.message });
      if (selectedEvent) {
        fetchRepositories(selectedEvent._id);
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi đồng bộ.",
      });
    } finally {
      setSyncingRepoId("");
    }
  };

  const handleUploadExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      await axios.post(
        `http://localhost:5000/api/events/${selectedEvent._id}/upload-exam`,
        {
          fileName: attachmentName,
          fileUrl: attachmentUrl,
          trackId: selectedTrack?._id || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setAttachmentName("");
      setAttachmentUrl("");
      setMessage({ type: "success", text: "Lưu tài liệu đề thi thành công!" });
      fetchEventDetails();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi tải tài liệu.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignRoleForTrack = async (email: string, trackId: string, role: "judge" | "mentor" = "judge", teamId?: string) => {
    if (!selectedEvent) return;
    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      await axios.post(
        "http://localhost:5000/api/auth/assign-role",
        {
          userEmail: email,
          eventId: selectedEvent._id,
          trackId: trackId,
          role: role,
          teamId: teamId || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMessage({
        type: "success",
        text: `Phân quyền ${role === 'judge' ? 'Giám khảo' : 'Mentor'} thành công!`,
      });
      fetchEventRoles();
      fetchTeamsList();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || `Lỗi phân quyền ${role === 'judge' ? 'Giám khảo' : 'Mentor'}.`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    if (!selectedEvent) return;
    const confirmed = await confirm({
      title: "Thu hồi quyền thành viên",
      message: "Bạn có chắc chắn muốn thu hồi quyền của thành viên này?",
      variant: "danger",
    });
    if (!confirmed) return;
    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      await axios.delete(
        `http://localhost:5000/api/events/${selectedEvent._id}/roles/${roleId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMessage({
        type: "success",
        text: "Thu hồi quyền thành viên thành công!",
      });
      fetchEventRoles();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi khi thu hồi quyền.",
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 relative z-30">
        <div>
          <h1 className="text-3xl font-extrabold text-white">
            <span className="text-cyan-400 text-cyan-glow font-mono-tech">THIẾT LẬP SỰ KIỆN</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Cấu hình cuộc thi, bảng đấu, vòng đấu, rubric chấm điểm và phân
            quyền ban tổ chức.
          </p>
        </div>
        {/* Quick select event */}
        {events.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              Xem nhanh cuộc thi:
            </span>
            <CustomSelect
              value={selectedEvent?._id || ""}
              onChange={(val) => {
                const ev = events.find((event) => event._id === val);
                if (ev) handleSelectEvent(ev);
              }}
              options={events.map((e: any) => ({
                value: e._id,
                label: `${e.name} (${e.semester} ${e.year})`,
              }))}
              placeholder="-- Chọn cuộc thi --"
              className="w-56 font-bold"
            />
          </div>
        )}
      </div>


      {/* EVENT HEADER PANEL (if selected) */}
      {selectedEvent && (
        <div className="glass p-6 rounded-2xl relative bg-gradient-to-r from-cyan-950/20 to-slate-900/20 z-10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-start flex-col md:flex-row gap-4">
            <div>
              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                [DETAIL_BOARD]
              </span>
              <h1 className="text-2xl font-black text-white mt-2 font-mono uppercase tracking-tight">
                {selectedEvent.name}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Học kỳ: {selectedEvent.semester} {selectedEvent.year} | Trạng
                thái:{" "}
                <span className="text-cyan-400 font-bold uppercase">
                  {selectedEvent.status}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
                <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                  Trạng thái:
                </label>
                <CustomSelect
                  value={selectedEvent.status}
                  onChange={(val) => handleUpdateEventStatus(val)}
                  options={[
                    { value: "draft", label: "Draft" },
                    { value: "registration", label: "Registration" },
                    { value: "ongoing", label: "Ongoing" },
                    { value: "completed", label: "Completed" },
                    { value: "cancelled", label: "Cancelled" },
                  ]}
                  className="w-36 font-semibold"
                />
              </div>
              <button
                onClick={() => {
                  setSelectedEvent(null);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white px-3 py-2 rounded-xl border border-slate-800 text-xs font-mono flex items-center gap-1 cursor-pointer"
              >
                <CalendarPlus size={14} />
                Tạo cuộc thi mới
              </button>
            </div>
          </div>
          {selectedEvent.description && (
            <p className="text-xs text-slate-400 mt-4 leading-relaxed bg-slate-950/30 p-3 rounded-xl border border-slate-800/40">
              {selectedEvent.description}
            </p>
          )}
        </div>
      )}
      {/* TAB NAVIGATION BAR */}
      {defaultTab === "events" && (
        <div className="flex flex-wrap gap-3 border-b border-slate-800/80 pb-3">
          <button
            onClick={() => setActiveTab("events")}
            className={`font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === "events"
              ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25 font-semibold"
              : "text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800"
              }`}
          >
            Thông tin sự kiện
          </button>
          <button
            onClick={() => setActiveTab("schedule")}
            className={`font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === "schedule"
              ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25 font-semibold"
              : "text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800"
              }`}
          >
            Thiết lập thời gian
          </button>
          <button
            onClick={() => setActiveTab("teams")}
            className={`font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === "teams"
              ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25 font-semibold"
              : "text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800"
              }`}
          >
            Đội thi tham gia
          </button>
          <button
            onClick={() => setActiveTab("rounds")}
            className={`font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === "rounds"
              ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25 font-semibold"
              : "text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800"
              }`}
          >
            Vòng thi & Tiêu chí
          </button>
          <button
            onClick={() => setActiveTab("tracks")}
            className={`font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === "tracks"
              ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25 font-semibold"
              : "text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800"
              }`}
          >
            Bảng đấu
          </button>
          <button
            onClick={() => setActiveTab("github")}
            className={`font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${activeTab === "github"
              ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25 font-semibold"
              : "text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800"
              }`}
          >
            <Github size={14} />
            GitHub & AI Đánh giá
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === "logs"
                ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25 font-semibold"
                : "text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800"
              }`}
          >
            Nhật ký hoạt động
          </button>
        </div>
      )}

      {/* TAB CONTENT AREAS */}

      {/* 1. ADMIN TAB */}


      {/* 2. EVENTS SETTINGS TAB */}
      {activeTab === "events" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main settings form */}
          <div className="lg:col-span-2 glass p-6 rounded-2xl relative">
            <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl"></div>

            {selectedEvent ? (
              // EDIT SELECTED EVENT FORM
              <>
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 font-mono">
                  <CalendarPlus size={20} className="text-cyan-400" />
                  <span>CẬP NHẬT THÔNG TIN SỰ KIỆN</span>
                </h2>

                <form onSubmit={handleUpdateEvent} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                      Tên Cuộc thi
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: SEAL Hackathon Spring 2026"
                      value={editEventName}
                      onChange={(e) => setEditEventName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                      GitHub Organization Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: seal-hackathon-2026"
                      value={editEventGithubOrgName}
                      onChange={(e) =>
                        setEditEventGithubOrgName(e.target.value)
                      }
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-slate-200"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                        Học kỳ
                      </label>
                      <CustomSelect
                        value={editEventSemester}
                        onChange={(val) => setEditEventSemester(val)}
                        options={[
                          { value: "Spring", label: "Spring" },
                          { value: "Summer", label: "Summer" },
                          { value: "Fall", label: "Fall" },
                        ]}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                        Năm
                      </label>
                      <input
                        type="number"
                        required
                        value={editEventYear}
                        onChange={(e) => setEditEventYear(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                        Số Đội Tối Đa (Max Teams)
                      </label>
                      <input
                        type="number"
                        required
                        value={editEventMaxTeams}
                        onChange={(e) => setEditEventMaxTeams(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-slate-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                      Mô tả Chi tiết Cuộc thi
                    </label>
                    <textarea
                      placeholder="Nhập thông tin giới thiệu, thời gian, thể lệ chính của sự kiện..."
                      rows={4}
                      value={editEventDesc}
                      onChange={(e) => setEditEventDesc(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-slate-200"
                    ></textarea>
                  </div>

                  <div className="flex justify-between pt-4">
                    <button
                      type="button"
                      onClick={() => setSelectedEvent(null)}
                      className="bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white px-5 py-2.5 rounded-xl text-sm border border-slate-800 font-mono flex items-center gap-1.5 cursor-pointer"
                    >
                      Hủy & Tạo mới
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-cyan-500 hover:bg-cyan-500 font-bold px-6 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2 cursor-pointer font-mono"
                    >
                      <span>
                        {loading ? "Đang cập nhật..." : "Lưu thay đổi"}
                      </span>
                      <CalendarPlus size={16} />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              // CREATE NEW EVENT FORM
              <>
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 font-mono">
                  <CalendarPlus size={20} className="text-cyan-400" />
                  <span>THIẾT LẬP SỰ KIỆN: KHỞI TẠO CUỘC THI MỚI</span>
                </h2>

                <form onSubmit={handleCreateEvent} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                      Tên Cuộc thi
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: SEAL Hackathon Spring 2026"
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                      GitHub Organization Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: seal-hackathon-2026"
                      value={githubOrgName}
                      onChange={(e) => setGithubOrgName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-slate-200"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                        Học kỳ
                      </label>
                      <CustomSelect
                        value={semester}
                        onChange={(val) => setSemester(val)}
                        options={[
                          { value: "Spring", label: "Spring" },
                          { value: "Summer", label: "Summer" },
                          { value: "Fall", label: "Fall" },
                        ]}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                        Năm
                      </label>
                      <input
                        type="number"
                        required
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                        Số Đội Tối Đa (Max Teams)
                      </label>
                      <input
                        type="number"
                        required
                        value={maxTeams}
                        onChange={(e) => setMaxTeams(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-slate-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                      Mô tả Chi tiết Cuộc thi
                    </label>
                    <textarea
                      placeholder="Nhập thông tin giới thiệu, thời gian, thể lệ chính của sự kiện..."
                      rows={4}
                      value={desc}
                      onChange={(e) => setDesc(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-slate-200"
                    ></textarea>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-cyan-500 hover:bg-cyan-500 font-bold px-6 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2 cursor-pointer font-mono"
                    >
                      <span>
                        {loading ? "Đang khởi tạo..." : "Khởi tạo Cuộc thi"}
                      </span>
                      <CalendarPlus size={16} />
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* Quick instructions */}
          <div className="lg:col-span-1 space-y-6 z-[-1]">
            <div className="glass p-6 rounded-2xl">
              <h3 className="text-md font-bold text-white mb-3 flex items-center gap-1.5 font-mono">
                <Info size={16} className="text-cyan-400" />
                <span>HƯỚNG DẪN THIẾT LẬP</span>
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                {selectedEvent
                  ? "Bạn đang chỉnh sửa cấu hình của cuộc thi được chọn. Thay đổi các thông tin chi tiết như tên, mô tả hoặc giới hạn số đội, sau đó bấm Lưu thay đổi."
                  : "Khởi tạo một cuộc thi mới đại diện cho học kỳ cụ thể. Cuộc thi này sẽ chứa các bảng đấu (Tracks) và vòng thi (Rounds) tiếp theo."}
              </p>
              <div className="mt-4 p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-cyan-300 font-mono">
                Lưu ý: Chỉ hệ thống Admin/Ban tổ chức mới được quyền khởi tạo
                hoặc cấu hình cuộc thi mới.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. TEAMS TAB */}
      {activeTab === "teams" &&
        (selectedEvent ? (
          <TeamsTab
            selectedEvent={selectedEvent}
            teamsList={teamsList}
            tracks={tracks}
            loading={loading}
            handleDistributeTeams={handleDistributeTeams}
            handleAssignTrack={handleAssignTrack}
          />
        ) : (
          <div className="glass p-8 text-center rounded-2xl text-slate-500 font-mono">
            Vui lòng chọn cuộc thi từ thanh tiêu đề hoặc trang Quản trị viên để
            quản lý Đội thi.
          </div>
        ))}

      {/* 4. TRACKS TAB */}
      {activeTab === "tracks" &&
        (selectedEvent ? (
          <TracksTab
            selectedEvent={selectedEvent}
            tracks={tracks}
            trackName={trackName}
            setTrackName={setTrackName}
            trackDesc={trackDesc}
            setTrackDesc={setTrackDesc}
            trackMax={trackMax}
            setTrackMax={setTrackMax}
            trackRoundId={trackRoundId}
            setTrackRoundId={setTrackRoundId}
            handleCreateTrack={handleCreateTrack}
            selectedTrack={selectedTrack}
            setSelectedTrack={setSelectedTrack}
            editingTrack={editingTrack}
            setEditingTrack={setEditingTrack}
            handleUpdateTrack={handleUpdateTrack}
            handleDeleteTrack={handleDeleteTrack}
            rounds={rounds}
            setSelectedRubricRoundId={setSelectedRubricRoundId}
            setRubric={setRubric}
            setCriteria={setCriteria}
            attachmentName={attachmentName}
            setAttachmentName={setAttachmentName}
            attachmentUrl={attachmentUrl}
            setAttachmentUrl={setAttachmentUrl}
            handleUploadExam={handleUploadExam}
            loading={loading}
            eventRoles={eventRoles}
            handleAssignRoleForTrack={handleAssignRoleForTrack}
            handleRemoveRole={handleRemoveRole}
            teamsList={teamsList}
          />
        ) : (
          <div className="glass p-8 text-center rounded-2xl text-slate-500 font-mono">
            Vui lòng chọn cuộc thi từ thanh tiêu đề hoặc trang Quản trị viên để
            quản lý Bảng đấu.
          </div>
        ))}

      {/* 5. ROUNDS TAB */}
      {activeTab === "rounds" &&
        (selectedEvent ? (
          <RoundsTab
            selectedEvent={selectedEvent}
            tracks={tracks}
            rounds={rounds}
            selectedTrack={selectedTrack}
            setSelectedTrack={setSelectedTrack}
            selectedRubricRoundId={selectedRubricRoundId}
            setSelectedRubricRoundId={setSelectedRubricRoundId}
            roundName={roundName}
            setRoundName={setRoundName}
            roundOrder={roundOrder}
            setRoundOrder={setRoundOrder}
            roundDeadline={roundDeadline}
            setRoundDeadline={setRoundDeadline}
            roundLimit={roundLimit}
            setRoundLimit={setRoundLimit}
            rubricTypeOption={rubricTypeOption}
            setRubricTypeOption={setRubricTypeOption}
            existingRubrics={existingRubrics}
            selectedSourceRubricId={selectedSourceRubricId}
            setSelectedSourceRubricId={setSelectedSourceRubricId}
            rubricName={rubricName}
            setRubricName={setRubricName}
            handleCreateRound={handleCreateRound}
            rubric={rubric}
            criteria={criteria}
            editingRubric={editingRubric}
            setEditingRubric={setEditingRubric}
            editRubricName={editRubricName}
            setEditRubricName={setEditRubricName}
            editRubricDesc={editRubricDesc}
            setEditRubricDesc={setEditRubricDesc}
            editRubricTotalWeight={editRubricTotalWeight}
            setEditRubricTotalWeight={setEditRubricTotalWeight}
            editRubricMaxScore={editRubricMaxScore}
            setEditRubricMaxScore={setEditRubricMaxScore}
            editRubricIsActive={editRubricIsActive}
            setEditRubricIsActive={setEditRubricIsActive}
            handleUpdateRubric={handleUpdateRubric}
            handleDeleteRubric={handleDeleteRubric}
            handleLockRubric={handleLockRubric}
            handleAdvanceRound={handleAdvanceRound}
            handleLockRound={handleLockRound}
            critCode={critCode}
            setCritCode={setCritCode}
            critName={critName}
            setCritName={setCritName}
            critWeight={critWeight}
            setCritWeight={setCritWeight}
            critDesc={critDesc}
            setCritDesc={setCritDesc}
            critMaxScore={critMaxScore}
            setCritMaxScore={setCritMaxScore}
            critGradingLevels={critGradingLevels}
            setCritGradingLevels={setCritGradingLevels}
            editingCriterion={editingCriterion}
            setEditingCriterion={setEditingCriterion}
            handleSaveCriterion={handleSaveCriterion}
            handleDeleteCriterion={handleDeleteCriterion}
            handleStartEditCriterion={handleStartEditCriterion}
            handleCancelEditCriterion={handleCancelEditCriterion}
            levelLabel={levelLabel}
            setLevelLabel={setLevelLabel}
            levelMinScore={levelMinScore}
            setLevelMinScore={setLevelMinScore}
            levelMaxScore={levelMaxScore}
            setLevelMaxScore={setLevelMaxScore}
            levelDesc={levelDesc}
            setLevelDesc={setLevelDesc}
            handleAddGradingLevel={handleAddGradingLevel}
            handleRemoveGradingLevel={handleRemoveGradingLevel}
            handleCreateRubric={handleCreateRubric}
            loading={loading}
            setRubric={setRubric}
            setCriteria={setCriteria}
            fetchRoundsAndRubric={fetchRoundsAndRubric}
          />
        ) : (
          <div className="glass p-8 text-center rounded-2xl text-slate-500 font-mono">
            Vui lòng chọn cuộc thi từ thanh tiêu đề hoặc trang Quản trị viên để
            quản lý Vòng thi.
          </div>
        ))}

      {/* 6. GITHUB TAB */}
      {activeTab === "github" &&
        (selectedEvent ? (
          <GithubTab
            repos={repos}
            allTeams={allTeams}
            linkingTeamId={linkingTeamId}
            setLinkingTeamId={setLinkingTeamId}
            manualRepoName={manualRepoName}
            setManualRepoName={setManualRepoName}
            manualRepoUrl={manualRepoUrl}
            setManualRepoUrl={setManualRepoUrl}
            syncingRepoId={syncingRepoId}
            handleCreateRepo={handleCreateRepo}
            handleLinkRepo={handleLinkRepo}
            handleSyncRepo={handleSyncRepo}
            selectedEvent={selectedEvent}
            handleKickAllCollaborators={handleKickAllCollaborators}
          />
        ) : (
          <div className="glass p-8 text-center rounded-2xl text-slate-500 font-mono">
            Vui lòng chọn cuộc thi từ thanh tiêu đề hoặc trang Quản trị viên để
            quản lý GitHub.
          </div>
        ))}

      {/* 7. EVENT LOGS TAB */}
      {activeTab === "logs" &&
        (selectedEvent ? (
          <div className="glass p-6 rounded-2xl border border-slate-800/80 bg-slate-900/20 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                  <Info size={20} className="text-cyan-400" />
                  <span>NHẬT KÝ HOẠT ĐỘNG SỰ KIỆN</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Nhật ký lưu lại các thay đổi quan trọng đối với cấu trúc và thiết lập thời gian của sự kiện.
                </p>
              </div>
              <button
                onClick={fetchEventLogs}
                className="bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono transition-all cursor-pointer"
              >
                Tải lại nhật ký
              </button>
            </div>

            {eventLogs.length > 0 ? (
              <div className="flow-root">
                <ul className="-mb-8">
                  {eventLogs.map((log: any, logIdx: number) => (
                    <li key={log._id}>
                      <div className="relative pb-8">
                        {logIdx !== eventLogs.length - 1 ? (
                          <span
                            className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-800"
                            aria-hidden="true"
                          />
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className="h-8 w-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center ring-8 ring-slate-900/50">
                              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-slate-200">
                                {log.details}{" "}
                                <span className="font-mono text-xs text-slate-500 font-medium">
                                  ({log.action})
                                </span>
                              </p>
                              <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                                <span>Thực hiện bởi:</span>
                                <span className="text-cyan-400 font-semibold">
                                  {log.actorId?.fullName || "Hệ thống"}
                                </span>
                                <span>({log.actorId?.email || "N/A"})</span>
                              </p>
                            </div>
                            <div className="text-right text-xs whitespace-nowrap text-slate-500 font-mono">
                              <time dateTime={log.createdAt}>
                                {new Date(log.createdAt).toLocaleString("vi-VN")}
                              </time>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 font-mono text-sm">
                Chưa có nhật ký hoạt động nào được ghi nhận cho sự kiện này.
              </div>
            )}
          </div>
        ) : (
          <div className="glass p-8 text-center rounded-2xl text-slate-500 font-mono">
            Vui lòng chọn cuộc thi từ thanh tiêu đề hoặc trang Quản trị viên để
            xem Nhật ký hoạt động.
          </div>
        ))}

      {/* 8. SCHEDULE TAB */}
      {activeTab === "schedule" &&
        (selectedEvent ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
            {/* Event Schedule Card */}
            <div className="glass p-6 rounded-2xl relative flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl"></div>
              <div>
                <h3 className="text-md font-bold text-white mb-4 flex items-center gap-1.5 font-mono">
                  <Calendar size={16} className="text-cyan-400" />
                  <span>Lịch trình cuộc thi: {selectedEvent.name}</span>
                </h3>
                <p className="text-slate-400 text-xs mb-6">
                  Cấu hình các mốc thời gian để hệ thống tự động cập nhật trạng thái cuộc thi (Registration, Ongoing, Completed).
                </p>

                <form onSubmit={handleSaveEventSchedule} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider">
                      Thời gian mở đăng ký (Registration)
                    </label>
                    <CustomDateTimePicker
                      value={editEventRegOpen}
                      onChange={setEditEventRegOpen}
                      placeholder="Chọn thời gian mở đăng ký..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider">
                      Thời gian đóng đăng ký (Đóng Đăng ký & Prepare)
                    </label>
                    <CustomDateTimePicker
                      value={editEventRegClose}
                      onChange={setEditEventRegClose}
                      placeholder="Chọn thời gian đóng đăng ký..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider">
                      Bắt đầu thi đấu (Chuyển sang Ongoing)
                    </label>
                    <CustomDateTimePicker
                      value={editEventContestStart}
                      onChange={setEditEventContestStart}
                      placeholder="Chọn thời gian bắt đầu thi..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider">
                      Kết thúc cuộc thi (Completed)
                    </label>
                    <CustomDateTimePicker
                      value={editEventContestEnd}
                      onChange={setEditEventContestEnd}
                      placeholder="Chọn thời gian kết thúc..."
                    />
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-800 text-white font-bold text-xs py-3 rounded-xl transition-all uppercase tracking-wider cursor-pointer shadow-lg shadow-cyan-500/20"
                    >
                      {loading ? "Đang lưu..." : "Lưu lịch trình cuộc thi"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Status information panel */}
              <div className="mt-6 p-4 bg-slate-950/50 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 leading-relaxed font-mono">
                <span className="text-cyan-400 font-bold">ℹ️ Hướng dẫn chuyển trạng thái tự động:</span>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li><strong>Draft &rarr; Registration:</strong> Khi tới thời điểm mở đăng ký.</li>
                  <li><strong>Registration &rarr; Ongoing:</strong> Khi tới thời điểm bắt đầu thi.</li>
                  <li><strong>Ongoing &rarr; Completed:</strong> Khi tới thời điểm kết thúc cuộc thi.</li>
                </ul>
              </div>
            </div>

            {/* Track Schedule Card */}
            <div className="glass p-6 rounded-2xl relative flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl"></div>
              <div>
                <h3 className="text-md font-bold text-white mb-4 flex items-center gap-1.5 font-mono">
                  <Clock size={16} className="text-cyan-400" />
                  <span>Lịch trình bảng đấu (Tracks)</span>
                </h3>
                <p className="text-slate-400 text-xs mb-6">
                  Thiết lập thời gian làm bài (nộp bài) và thời gian chấm bài cho từng bảng đấu. Bộ đếm thời gian của Giám khảo sẽ dựa trên thông số này.
                </p>

                {tracks.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs font-mono">
                    Chưa có bảng đấu nào trong cuộc thi này.
                  </div>
                ) : (
                  <form onSubmit={handleSaveTrackSchedule} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider">
                        Chọn bảng đấu (Track)
                      </label>
                      <CustomSelect
                        value={selectedTrackForSchedule?._id || ""}
                        onChange={(val) => {
                          const t = tracks.find((track) => track._id === val);
                          handleSelectTrackForSchedule(t);
                        }}
                        options={tracks.map((t) => ({
                          value: t._id,
                          label: `${t.name} (Vòng: ${rounds.find((r) => r._id === t.roundId)?.name || "Chưa gán"})`,
                        }))}
                        className="w-full"
                      />
                    </div>

                    {selectedTrackForSchedule && (
                      <>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider">
                            Thời gian bắt đầu làm bài
                          </label>
                          <CustomDateTimePicker
                            value={trackStartTime}
                            onChange={setTrackStartTime}
                            placeholder="Chọn thời gian bắt đầu làm bài..."
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider">
                            Hạn nộp bài (Thời gian làm bài kết thúc)
                          </label>
                          <CustomDateTimePicker
                            value={trackEndTime}
                            onChange={setTrackEndTime}
                            placeholder="Chọn hạn nộp bài..."
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider">
                            Thời gian chấm bài kết thúc
                          </label>
                          <CustomDateTimePicker
                            value={trackGradingEndTime}
                            onChange={setTrackGradingEndTime}
                            placeholder="Chọn thời gian kết thúc chấm..."
                          />
                        </div>

                        <div className="pt-4">
                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-800 text-white font-bold text-xs py-3 rounded-xl transition-all uppercase tracking-wider cursor-pointer shadow-lg shadow-cyan-500/20"
                          >
                            {loading ? "Đang lưu..." : "Lưu lịch trình bảng đấu"}
                          </button>
                        </div>
                      </>
                    )}
                  </form>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="glass p-8 text-center rounded-2xl text-slate-500 font-mono">
            Vui lòng chọn cuộc thi từ thanh tiêu đề hoặc trang Quản trị viên để thiết lập thời gian.
          </div>
        ))}
    </div>
  );
}
