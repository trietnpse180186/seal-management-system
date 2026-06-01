import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  CalendarPlus,
  FolderKanban,
  Info,
  Settings2,
  Users,
} from "lucide-react";
import TeamsTab from "./TeamsTab";
import TracksTab from "./TracksTab";
import RoundsTab from "./RoundsTab";
import GithubTab from "./GithubTab";

const Github = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
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

interface AdminDashboardProps {
  defaultTab?: "admin" | "events";
}

export default function AdminDashboard({ defaultTab = "admin" }: AdminDashboardProps) {
  const token = localStorage.getItem("token");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const eventIdParam = searchParams.get('eventId');
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

  const [roleEmail, setRoleEmail] = useState("");
  const [roleType, setRoleType] = useState("judge");
  const [roleTrackId, setRoleTrackId] = useState("");
  const [eventRoles, setEventRoles] = useState<any[]>([]);
  const [teamsList, setTeamsList] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Tab management state
  const [activeTab, setActiveTab] = useState<'admin' | 'events' | 'teams' | 'tracks' | 'rounds' | 'github'>(defaultTab);

  // Edit Event States
  const [editEventName, setEditEventName] = useState("");
  const [editEventSemester, setEditEventSemester] = useState("Spring");
  const [editEventYear, setEditEventYear] = useState("2026");
  const [editEventDesc, setEditEventDesc] = useState("");
  const [editEventMaxTeams, setEditEventMaxTeams] = useState("10");
  const [editEventGithubOrgName, setEditEventGithubOrgName] = useState("");

  // Rubric Edit Form States
  const [selectedRubricRoundId, setSelectedRubricRoundId] = useState('');
  const [editingRubric, setEditingRubric] = useState(false);
  const [editRubricName, setEditRubricName] = useState('');
  const [editRubricDesc, setEditRubricDesc] = useState('');
  const [editRubricTotalWeight, setEditRubricTotalWeight] = useState('100');
  const [editRubricMaxScore, setEditRubricMaxScore] = useState('10');
  const [editRubricIsActive, setEditRubricIsActive] = useState(true);

  // Criterion States (Advanced)
  const [critMaxScore, setCritMaxScore] = useState('10');
  const [critOrder, setCritOrder] = useState('1');
  const [critGradingLevels, setCritGradingLevels] = useState<any[]>([]);
  const [editingCriterion, setEditingCriterion] = useState<any>(null);

  // Grading Level Form States
  const [levelLabel, setLevelLabel] = useState('');
  const [levelMinScore, setLevelMinScore] = useState('');
  const [levelMaxScore, setLevelMaxScore] = useState('');
  const [levelDesc, setLevelDesc] = useState('');

  // GitHub integration states
  const [githubOrgName, setGithubOrgName] = useState('seal-hackathon-2026');
  const [repos, setRepos] = useState<any[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [linkingTeamId, setLinkingTeamId] = useState('');
  const [manualRepoName, setManualRepoName] = useState('');
  const [manualRepoUrl, setManualRepoUrl] = useState('');
  const [syncingRepoId, setSyncingRepoId] = useState('');

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
    if (eventIdParam) {
      const foundEvent = events.find(e => e._id === eventIdParam);
      if (foundEvent) {
        setSelectedEvent(foundEvent);
        setEditEventName(foundEvent.name || "");
        setEditEventSemester(foundEvent.semester || "Spring");
        setEditEventYear(String(foundEvent.year || 2026));
        setEditEventDesc(foundEvent.description || "");
        setEditEventMaxTeams(String(foundEvent.maxTeams || 10));
        setEditEventGithubOrgName(foundEvent.githubOrgName || "");
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
      const res = await axios.get(`http://localhost:5000/api/github-repositories?eventId=${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRepos(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAllTeams = async (eventId: string) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/teams/all/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllTeams(res.data.filter((t: any) => t.status === 'confirmed'));
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

      fetchEventRoles();
      fetchTeamsList();
      fetchRepositories(selectedEvent._id);
      fetchAllTeams(selectedEvent._id);
    } catch (err) {
      console.error("Lỗi fetch chi tiết sự kiện:", err);
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

    if (
      !window.confirm(
        `Bạn có chắc chắn muốn phân chia ngẫu nhiên ${unassignedTeams.length} đội thi vào ${tracks.length} bảng đấu? Hệ thống sẽ tự động tạo repository GitHub cho các đội.`,
      )
    ) {
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
      if (
        !window.confirm(
          "Bạn có chắc muốn phân bảng đấu ngẫu nhiên cho đội thi này?",
        )
      ) {
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

    // If we are currently on the 'events' tab/route, sync URL
    if (defaultTab === 'events') {
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

  const handleEventDoubleClick = (eventObj: any) => {
    navigate(`/admin/events?eventId=${eventObj._id}`);
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
        { headers: { Authorization: `Bearer ${token}` } }
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
    setMessage({ type: '', text: '' });
    setLoading(true);

    try {
      const res = await axios.put(
        `http://localhost:5000/api/events/${selectedEvent._id}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ type: 'success', text: 'Cập nhật trạng thái cuộc thi thành công!' });
      setSelectedEvent(res.data.event);
      fetchEvents();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Lỗi khi cập nhật trạng thái cuộc thi.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    if (!trackRoundId) {
      setMessage({ type: "error", text: "Vui lòng chọn Vòng thi cho Bảng đấu." });
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
          maxTeams: parseInt(trackMax),
          roundId: trackRoundId,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const newTrack = res.data;
      setTrackName("");
      setTrackDesc("");
      setTrackRoundId("");

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

      // 2. Setup Rubric if a track is selected (Create empty or Clone)
      if (selectedTrack) {
        if (rubricTypeOption === "existing" && selectedSourceRubricId) {
          // Clone rubric API
          await axios.post(
            "http://localhost:5000/api/rubrics/clone",
            {
              fromRubricId: selectedSourceRubricId,
              eventId: selectedEvent._id,
              trackId: selectedTrack._id,
              roundId: newRound._id,
              name: `Rubric ${newRound.name}`,
            },
            { headers: { Authorization: `Bearer ${token}` } },
          );
          setMessage({
            type: "success",
            text: `Tạo vòng đấu và sao chép Rubric thành công cho bảng ${selectedTrack.name}!`,
          });
        } else {
          // Create empty Rubric
          await axios.post(
            "http://localhost:5000/api/rubrics",
            {
              eventId: selectedEvent._id,
              trackId: selectedTrack._id,
              roundId: newRound._id,
              name: rubricName || `Rubric ${newRound.name}`,
            },
            { headers: { Authorization: `Bearer ${token}` } },
          );
          setMessage({
            type: "success",
            text: `Tạo vòng đấu và khởi tạo Rubric trống thành công cho bảng ${selectedTrack.name}!`,
          });
        }
      } else {
        setMessage({
          type: "success",
          text: `Tạo vòng đấu thành công! (Chưa thiết lập Rubric vì chưa chọn Bảng đấu)`,
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
      const res = await axios.get(`http://localhost:5000/api/rubrics/round/${selectedRubricRoundId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRubric(res.data.rubric);
      setCriteria(res.data.criteria || []);
      
      // Populate edit fields if rubric exists
      if (res.data.rubric) {
        setEditRubricName(res.data.rubric.name);
        setEditRubricDesc(res.data.rubric.description || '');
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
      const associatedRound = rounds.find((r: any) => r._id === selectedTrack.roundId);
      if (associatedRound) {
        setSelectedRubricRoundId(associatedRound._id);
      } else {
        setSelectedRubricRoundId('');
        setRubric(null);
        setCriteria([]);
      }
    } else {
      setSelectedRubricRoundId('');
      setRubric(null);
      setCriteria([]);
    }
  }, [selectedTrack, rounds]);

  const handleCreateRubric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !selectedTrack || !selectedRubricRoundId) return;

    try {
      await axios.post(
        'http://localhost:5000/api/rubrics',
        {
          eventId: selectedEvent._id,
          trackId: selectedTrack._id,
          roundId: selectedRubricRoundId,
          name: rubricName
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRubricName('');
      setMessage({ type: 'success', text: 'Khởi tạo Rubric thành công!' });
      fetchRoundsAndRubric();
      fetchExistingRubrics();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Lỗi khi khởi tạo Rubric.' });
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
          isActive: editRubricIsActive
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRubric(res.data);
      setEditingRubric(false);
      setMessage({ type: 'success', text: 'Cập nhật Rubric thành công!' });
      fetchRoundsAndRubric();
      fetchExistingRubrics();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Lỗi khi cập nhật Rubric.' });
    }
  };

  const handleDeleteRubric = async () => {
    if (!rubric) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa/vô hiệu hóa Rubric này?')) return;
    try {
      await axios.delete(
        `http://localhost:5000/api/rubrics/${rubric._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRubric(null);
      setCriteria([]);
      setMessage({ type: 'success', text: 'Đã xóa Rubric thành công.' });
      fetchRoundsAndRubric();
      fetchExistingRubrics();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Lỗi khi xóa Rubric.' });
    }
  };

  const handleSaveCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rubric) return;

    const parsedWeight = parseFloat(critWeight);
    const parsedMaxScore = parseFloat(critMaxScore);
    const parsedOrder = parseInt(critOrder);

    if (isNaN(parsedWeight) || isNaN(parsedMaxScore)) {
      setMessage({ type: 'error', text: 'Trọng số và điểm tối đa phải là số.' });
      return;
    }

    const payload: any = {
      code: critCode.trim().toUpperCase(),
      name: critName.trim(),
      description: critDesc.trim(),
      weight: parsedWeight,
      maxScore: parsedMaxScore,
      gradingLevels: critGradingLevels
    };

    if (editingCriterion) {
      payload.order = isNaN(parsedOrder) ? undefined : parsedOrder;
    }

    try {
      if (editingCriterion) {
        await axios.put(
          `http://localhost:5000/api/criteria/${editingCriterion._id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessage({ type: 'success', text: 'Cập nhật tiêu chí chấm điểm thành công!' });
      } else {
        await axios.post(
          `http://localhost:5000/api/criteria/rubric/${rubric._id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessage({ type: 'success', text: 'Đã thêm tiêu chí chấm điểm mới!' });
      }

      setCritCode('');
      setCritName('');
      setCritDesc('');
      setCritWeight('20');
      setCritMaxScore('10');
      setCritOrder('1');
      setCritGradingLevels([]);
      setEditingCriterion(null);
      fetchRoundsAndRubric();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Lỗi khi lưu tiêu chí.' });
    }
  };

  const handleDeleteCriterion = async (criterionId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tiêu chí này?')) return;
    try {
      await axios.delete(
        `http://localhost:5000/api/criteria/${criterionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ type: 'success', text: 'Đã xóa tiêu chí thành công.' });
      fetchRoundsAndRubric();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Lỗi khi xóa tiêu chí.' });
    }
  };

  const handleStartEditCriterion = (c: any) => {
    setEditingCriterion(c);
    setCritCode(c.code);
    setCritName(c.name);
    setCritDesc(c.description || '');
    setCritWeight(String(c.weight));
    setCritMaxScore(String(c.maxScore || 10));
    setCritOrder(String(c.order || 1));
    setCritGradingLevels(c.gradingLevels || []);
  };

  const handleCancelEditCriterion = () => {
    setEditingCriterion(null);
    setCritCode('');
    setCritName('');
    setCritDesc('');
    setCritWeight('20');
    setCritMaxScore('10');
    setCritOrder('1');
    setCritGradingLevels([]);
  };

  const handleAddGradingLevel = () => {
    if (!levelLabel.trim() || levelMinScore === '' || levelMaxScore === '') {
      alert('Vui lòng điền nhãn, điểm tối thiểu và điểm tối đa.');
      return;
    }
    const min = parseFloat(levelMinScore);
    const max = parseFloat(levelMaxScore);
    if (isNaN(min) || isNaN(max)) {
      alert('Điểm số phải là số.');
      return;
    }
    if (min > max) {
      alert('Điểm tối thiểu không được lớn hơn điểm tối đa.');
      return;
    }

    const newLvl = {
      label: levelLabel.trim(),
      minScore: min,
      maxScore: max,
      description: levelDesc.trim()
    };

    setCritGradingLevels(prev => {
      const updated = [...prev, newLvl];
      return updated.sort((a, b) => a.minScore - b.minScore);
    });

    setLevelLabel('');
    setLevelMinScore('');
    setLevelMaxScore('');
    setLevelDesc('');
  };

  const handleRemoveGradingLevel = (index: number) => {
    setCritGradingLevels(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleLockRubric = async () => {
    if (!rubric) return;
    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const res = await axios.post(
        `http://localhost:5000/api/rubrics/${rubric._id}/lock`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
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

  const handleCreateRepo = async (teamId: string) => {
    setMessage({ type: '', text: '' });
    try {
      const res = await axios.post(
        'http://localhost:5000/api/github-repositories/create',
        { teamId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ type: 'success', text: res.data.message });
      if (selectedEvent) {
        fetchRepositories(selectedEvent._id);
        fetchAllTeams(selectedEvent._id);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Lỗi khi tạo repository.' });
    }
  };

  const handleLinkRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingTeamId || !manualRepoName || !manualRepoUrl) return;
    setMessage({ type: '', text: '' });

    try {
      const res = await axios.post(
        'http://localhost:5000/api/github-repositories/link',
        { teamId: linkingTeamId, repoName: manualRepoName, repoUrl: manualRepoUrl },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ type: 'success', text: res.data.message });
      setManualRepoName('');
      setManualRepoUrl('');
      setLinkingTeamId('');
      if (selectedEvent) {
        fetchRepositories(selectedEvent._id);
        fetchAllTeams(selectedEvent._id);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Lỗi khi liên kết repository.' });
    }
  };

  const handleSyncRepo = async (repoId: string) => {
    setSyncingRepoId(repoId);
    setMessage({ type: '', text: '' });
    try {
      setMessage({ type: 'success', text: 'Đang bắt đầu đồng bộ và chạy AI Review...' });
      const res = await axios.post(
        `http://localhost:5000/api/github-repositories/${repoId}/sync`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ type: 'success', text: res.data.message });
      if (selectedEvent) {
        fetchRepositories(selectedEvent._id);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Lỗi khi đồng bộ.' });
    } finally {
      setSyncingRepoId('');
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

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      await axios.post(
        "http://localhost:5000/api/auth/assign-role",
        {
          userEmail: roleEmail,
          eventId: selectedEvent._id,
          trackId: roleTrackId || undefined,
          role: roleType,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setRoleEmail("");
      setRoleTrackId("");
      setMessage({
        type: "success",
        text: `Cấp quyền ${roleType.toUpperCase()} thành công!`,
      });
      fetchEventRoles();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi phân quyền.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    if (!selectedEvent) return;
    if (
      !window.confirm("Bạn có chắc chắn muốn thu hồi quyền của thành viên này?")
    )
      return;
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Settings2 className="text-indigo-400" />
            <span>Thiết lập Cuộc thi (Event Dashboard)</span>
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
            <select
              value={selectedEvent?._id || ""}
              onChange={(e) => {
                const ev = events.find((event) => event._id === e.target.value);
                if (ev) handleSelectEvent(ev);
              }}
              className="bg-slate-900 border border-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-lg focus:border-indigo-500 outline-none"
            >
              <option value="">-- Chọn cuộc thi --</option>
              {events.map((e: any) => (
                <option key={e._id} value={e._id}>
                  {e.name} ({e.semester} {e.year})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* System message display */}
      {message.text && (
        <div
          className={`p-4 rounded-xl text-sm border flex items-center gap-2 mb-6 ${
            message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}
        >
          <Info size={18} />
          <span>{message.text}</span>
        </div>
      )}

      {/* EVENT HEADER PANEL (if selected) */}
      {selectedEvent && (
        <div className="glass p-6 rounded-2xl relative overflow-hidden bg-gradient-to-r from-indigo-950/20 to-slate-900/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-start flex-col md:flex-row gap-4">
            <div>
              <span className="text-[10px] bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                [DETAIL_BOARD]
              </span>
              <h1 className="text-2xl font-black text-white mt-2 font-mono uppercase tracking-tight">
                {selectedEvent.name}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Học kỳ: {selectedEvent.semester} {selectedEvent.year} |
                Trạng thái:{" "}
                <span className="text-indigo-400 font-bold uppercase">
                  {selectedEvent.status}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
                <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Trạng thái:</label>
                <select
                  value={selectedEvent.status}
                  onChange={(e) => handleUpdateEventStatus(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option className="bg-slate-900" value="draft">Draft</option>
                  <option className="bg-slate-900" value="registration">Registration</option>
                  <option className="bg-slate-900" value="ongoing">Ongoing</option>
                  <option className="bg-slate-900" value="completed">Completed</option>
                  <option className="bg-slate-900" value="cancelled">Cancelled</option>
                </select>
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
            className={`font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === "events"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 font-semibold"
                : "text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800"
            }`}
          >
            Thông tin sự kiện
          </button>
          <button
            onClick={() => setActiveTab("teams")}
            className={`font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === "teams"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 font-semibold"
                : "text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800"
            }`}
          >
            Đội thi tham gia
          </button>
          <button
            onClick={() => setActiveTab("tracks")}
            className={`font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === "tracks"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 font-semibold"
                : "text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800"
            }`}
          >
            Bảng đấu
          </button>
          <button
            onClick={() => setActiveTab("rounds")}
            className={`font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === "rounds"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 font-semibold"
                : "text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800"
            }`}
          >
            Vòng thi & Tiêu chí
          </button>
          <button
            onClick={() => setActiveTab("github")}
            className={`font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "github"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 font-semibold"
                : "text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800"
            }`}
          >
            <Github size={14} />
            GitHub & AI Đánh giá
          </button>
        </div>
      )}

      {/* TAB CONTENT AREAS */}
      
      {/* 1. ADMIN TAB */}
      {activeTab === "admin" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left panel: List existing events */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-md font-bold text-white mb-2 flex items-center gap-2 font-mono">
              <FolderKanban size={18} className="text-indigo-400" />
              <span>DANH SÁCH SỰ KIỆN HIỆN CÓ</span>
            </h3>
            {events.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {events.map((e: any) => (
                  <button
                    key={e._id}
                    onClick={() => handleSelectEvent(e)}
                    onDoubleClick={() => handleEventDoubleClick(e)}
                    className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between h-40 ${
                      selectedEvent?._id === e._id
                        ? "bg-indigo-600/10 border-indigo-500 shadow-md text-white font-bold"
                        : "border-slate-800 bg-slate-900/30 hover:border-slate-700 text-slate-400"
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start w-full">
                        <span className={`font-mono text-sm tracking-tight ${selectedEvent?._id === e._id ? 'text-indigo-405' : 'text-slate-200'}`}>
                          {e.name}
                        </span>
                        <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded font-mono border border-slate-800 text-slate-350">
                          {e.semester} {e.year}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2 line-clamp-3 font-sans font-normal leading-normal">
                        {e.description || "Chưa có mô tả chi tiết."}
                      </p>
                    </div>
                    
                    <div className="flex justify-between items-center w-full mt-4 pt-2 border-t border-slate-800/40 text-[10px] font-mono">
                      <span>Trạng thái: <strong className="text-indigo-300 uppercase">{e.status}</strong></span>
                      <span className="text-indigo-450 font-bold bg-indigo-500/5 px-2.5 py-0.5 rounded">
                        {e.teamCount || 0} Đội tham gia
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic font-mono">Chưa có cuộc thi nào được khởi tạo.</p>
            )}
          </div>

          {/* Right panel: Role assignment & list */}
          <div className="lg:col-span-1 space-y-6">
            {selectedEvent ? (
              <>
                {/* Role Assignment Form */}
                <div className="glass p-6 rounded-2xl">
                  <h3 className="text-md font-bold text-white mb-4 flex items-center gap-1.5 font-mono">
                    <Users size={16} className="text-indigo-400" />
                    <span>Phân quyền thành viên</span>
                  </h3>

                  <form onSubmit={handleAssignRole} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                        Email Người dùng
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="giamkhao@domain.com"
                        value={roleEmail}
                        onChange={(e) => setRoleEmail(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-xs font-mono bg-slate-950 border border-slate-850 text-slate-200 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                        Vai trò
                      </label>
                      <select
                        value={roleType}
                        onChange={(e) => setRoleType(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-xs font-mono bg-slate-950 border border-slate-850 text-slate-350"
                      >
                        <option value="judge">Giám khảo</option>
                        <option value="coordinator">Ban tổ chức</option>
                        <option value="mentor">Cố vấn</option>
                        <option value="participant">Thí sinh</option>
                      </select>
                    </div>

                    {(roleType === "judge" ||
                      roleType === "mentor" ||
                      roleType === "participant") && (
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                          Bảng đấu
                        </label>
                        <select
                          value={roleTrackId}
                          onChange={(e) => setRoleTrackId(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl text-xs font-mono bg-slate-950 border border-slate-850 text-slate-300"
                        >
                          <option value="">Toàn bộ cuộc thi (Không chọn Track)</option>
                          {tracks.map((t: any) => (
                            <option key={t._id} value={t._id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer font-mono"
                    >
                      Gán Quyền Hạn
                    </button>
                  </form>
                </div>

                {/* Assigned Roles List */}
                <div className="glass p-6 rounded-2xl">
                  <h3 className="text-md font-bold text-white mb-3 flex items-center gap-1.5 font-mono">
                    <Users size={16} className="text-indigo-400" />
                    <span>Danh sách phân quyền ({eventRoles.length})</span>
                  </h3>
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {eventRoles.map((role: any) => (
                      <div
                        key={role._id}
                        className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/80 text-xs flex justify-between items-center font-sans"
                      >
                        <div>
                          <p className="font-bold text-slate-200">
                            {role.userId?.fullName || "Không rõ tên"}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {role.userId?.email}
                          </p>
                          <p className="text-[10px] text-indigo-400 font-mono mt-0.5 uppercase font-bold">
                            {role.role}{" "}
                            {role.trackId
                              ? `// Bảng: ${role.trackId.name}`
                              : "// Toàn cuộc thi"}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveRole(role._id)}
                          className="text-rose-500 hover:text-rose-400 font-bold text-[10px] uppercase font-mono border border-rose-500/20 hover:border-rose-500/40 px-2 py-1 rounded bg-rose-500/5 cursor-pointer"
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                    {eventRoles.length === 0 && (
                      <p className="text-xs text-slate-500 italic py-2 text-center">
                        Chưa có ai được phân quyền cho cuộc thi này.
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="glass p-6 rounded-2xl text-center py-12 text-slate-500 font-mono border-dashed border-slate-800">
                <Users size={32} className="mx-auto mb-3 text-slate-600" />
                <p className="text-xs">Vui lòng chọn sự kiện ở danh sách bên trái để thực hiện phân quyền.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. EVENTS SETTINGS TAB */}
      {activeTab === "events" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main settings form */}
          <div className="lg:col-span-2 glass p-6 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl"></div>
            
            {selectedEvent ? (
              // EDIT SELECTED EVENT FORM
              <>
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 font-mono">
                  <CalendarPlus size={20} className="text-indigo-400" />
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
                      onChange={(e) => setEditEventGithubOrgName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-slate-200"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                        Học kỳ
                      </label>
                      <select
                        value={editEventSemester}
                        onChange={(e) => setEditEventSemester(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-white"
                      >
                        <option value="Spring">Spring</option>
                        <option value="Summer">Summer</option>
                        <option value="Fall">Fall</option>
                      </select>
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
                      className="bg-indigo-600 hover:bg-indigo-500 font-bold px-6 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2 cursor-pointer font-mono"
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
                  <CalendarPlus size={20} className="text-indigo-400" />
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
                      <select
                        value={semester}
                        onChange={(e) => setSemester(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-mono bg-slate-950 border border-slate-850 text-white"
                      >
                        <option value="Spring">Spring</option>
                        <option value="Summer">Summer</option>
                        <option value="Fall">Fall</option>
                      </select>
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
                      className="bg-indigo-600 hover:bg-indigo-500 font-bold px-6 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2 cursor-pointer font-mono"
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
          <div className="lg:col-span-1 space-y-6">
            <div className="glass p-6 rounded-2xl">
              <h3 className="text-md font-bold text-white mb-3 flex items-center gap-1.5 font-mono">
                <Info size={16} className="text-indigo-400" />
                <span>HƯỚNG DẪN THIẾT LẬP</span>
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                {selectedEvent ? (
                  "Bạn đang chỉnh sửa cấu hình của cuộc thi được chọn. Thay đổi các thông tin chi tiết như tên, mô tả hoặc giới hạn số đội, sau đó bấm Lưu thay đổi."
                ) : (
                  "Khởi tạo một cuộc thi mới đại diện cho học kỳ cụ thể. Cuộc thi này sẽ chứa các bảng đấu (Tracks) và vòng thi (Rounds) tiếp theo."
                )}
              </p>
              <div className="mt-4 p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-indigo-300 font-mono">
                Lưu ý: Chỉ hệ thống Admin/Ban tổ chức mới được quyền khởi tạo hoặc cấu hình cuộc thi mới.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. TEAMS TAB */}
      {activeTab === "teams" && (
        selectedEvent ? (
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
            Vui lòng chọn cuộc thi từ thanh tiêu đề hoặc trang Quản trị viên để quản lý Đội thi.
          </div>
        )
      )}

      {/* 4. TRACKS TAB */}
      {activeTab === "tracks" && (
        selectedEvent ? (
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
          />
        ) : (
          <div className="glass p-8 text-center rounded-2xl text-slate-500 font-mono">
            Vui lòng chọn cuộc thi từ thanh tiêu đề hoặc trang Quản trị viên để quản lý Bảng đấu.
          </div>
        )
      )}

      {/* 5. ROUNDS TAB */}
      {activeTab === "rounds" && (
        selectedEvent ? (
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
          />
        ) : (
          <div className="glass p-8 text-center rounded-2xl text-slate-500 font-mono">
            Vui lòng chọn cuộc thi từ thanh tiêu đề hoặc trang Quản trị viên để quản lý Vòng thi.
          </div>
        )
      )}

      {/* 6. GITHUB TAB */}
      {activeTab === "github" && (
        selectedEvent ? (
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
          />
        ) : (
          <div className="glass p-8 text-center rounded-2xl text-slate-500 font-mono">
            Vui lòng chọn cuộc thi từ thanh tiêu đề hoặc trang Quản trị viên để quản lý GitHub.
          </div>
        )
      )}
    </div>
  );
}
