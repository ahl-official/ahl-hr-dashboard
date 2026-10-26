import { NextResponse } from "next/server";
import {
  getFmsCandidatesStore,
  getFmsCandidatesStats,
  addFmsCandidateStore,
  updateFmsCandidateStore,
  getFmsCandidateById,
  advanceCandidateStageStore,
  revertCandidateStageStore,
  toggleCandidateChecklistStore,
  dropCandidateStore,
  restoreCandidateStore,
  getInterviewsStore,
  getInterviewsStats,
  scheduleInterviewStore,
  logInterviewOutcomeStore,
  deleteFmsCandidateStore,
} from "@/lib/fms-candidates-store";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get("refresh") === "true" || searchParams.get("refresh") === "1";
    const interviewsDate = searchParams.get("interviewsDate");

    if (interviewsDate !== null) {
      const [interviews, intStats] = await Promise.all([
        getInterviewsStore(interviewsDate),
        getInterviewsStats(interviewsDate),
      ]);
      return NextResponse.json({
        success: true,
        data: {
          interviews,
          total: interviews.length,
          stats: intStats,
          date: interviewsDate,
        },
      });
    }

    const search = searchParams.get("search")?.toLowerCase().trim();
    const requisitionId = searchParams.get("requisitionId")?.trim();
    const stage = searchParams.get("stage")?.trim();
    const status = searchParams.get("status")?.trim();
    const source = searchParams.get("source")?.trim();

    const [allCandidates, stats] = await Promise.all([
      getFmsCandidatesStore(forceRefresh),
      getFmsCandidatesStats(),
    ]);

    let filtered = allCandidates;

    if (requisitionId && requisitionId !== "All") {
      filtered = filtered.filter((c) => c.requisitionId === requisitionId);
    }

    if (stage && stage !== "All") {
      filtered = filtered.filter(
        (c) => c.currentStage.toLowerCase() === stage.toLowerCase()
      );
    }

    if (status && status !== "All") {
      filtered = filtered.filter(
        (c) => c.status.toLowerCase() === status.toLowerCase()
      );
    }

    if (source && source !== "All") {
      filtered = filtered.filter(
        (c) => (c.source || "").toLowerCase() === source.toLowerCase()
      );
    }

    if (search) {
      filtered = filtered.filter((c) => {
        return (
          c.fullName.toLowerCase().includes(search) ||
          c.id.toLowerCase().includes(search) ||
          (c.phone && c.phone.includes(search)) ||
          (c.email && c.email.toLowerCase().includes(search)) ||
          (c.position && c.position.toLowerCase().includes(search)) ||
          (c.requisitionId && c.requisitionId.toLowerCase().includes(search))
        );
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        candidates: filtered,
        total: filtered.length,
        stats,
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/recruitment/candidates-fms:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch candidates" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Advance Candidate Stage action
    if (body.action === "advance" && body.id) {
      const advanced = await advanceCandidateStageStore(
        body.id,
        body.fieldUpdates,
        body.customNextPlannedDate
      );
      if (!advanced) {
        return NextResponse.json(
          { success: false, message: `Candidate ${body.id} not found` },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: advanced });
    }

    // Revert Candidate Stage action
    if (body.action === "revert" && body.id) {
      const reverted = await revertCandidateStageStore(body.id, body.reason);
      if (!reverted) {
        return NextResponse.json(
          { success: false, message: `Candidate ${body.id} not found` },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: reverted });
    }

    // Toggle Checklist Item action
    if (body.action === "toggle-checklist" && body.id && body.stageId && body.itemText) {
      const updated = await toggleCandidateChecklistStore(
        body.id,
        body.stageId,
        body.itemText,
        Boolean(body.checked)
      );
      if (!updated) {
        return NextResponse.json(
          { success: false, message: `Candidate ${body.id} not found` },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: updated });
    }

    // Drop / Reject action
    if (body.action === "drop" && body.id) {
      const dropped = await dropCandidateStore(body.id, body.reason || "Dropped");
      if (!dropped) {
        return NextResponse.json(
          { success: false, message: `Candidate ${body.id} not found` },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: dropped });
    }

    // Restore action
    if (body.action === "restore" && body.id) {
      const restored = await restoreCandidateStore(body.id);
      if (!restored) {
        return NextResponse.json(
          { success: false, message: `Candidate ${body.id} not found` },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: restored });
    }

    // Delete candidate action
    if (body.action === "delete" && body.id) {
      await deleteFmsCandidateStore(body.id);
      return NextResponse.json({ success: true, message: `Candidate ${body.id} deleted` });
    }

    // Check if this is an update action
    if (body.action === "update" && body.id) {
      const updated = await updateFmsCandidateStore(body.id, body.updates || {});
      if (!updated) {
        return NextResponse.json(
          { success: false, message: `Candidate ${body.id} not found` },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: updated });
    }

    // Schedule interview action
    if (body.action === "schedule-interview" && body.candidateId) {
      const res = await scheduleInterviewStore({
        candidateId: body.candidateId,
        roundName: body.roundName || "Interview Round",
        scheduledDate: body.scheduledDate || new Date().toISOString().slice(0, 10),
        scheduledTime: body.scheduledTime || "11:00 AM",
        mode: body.mode || "In-Person",
        locationOrLink: body.locationOrLink,
        interviewerName: body.interviewerName || "Interviewer",
        durationMinutes: body.durationMinutes,
      });
      if (!res) {
        return NextResponse.json(
          { success: false, message: `Candidate ${body.candidateId} not found` },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: res });
    }

    // Log interview outcome action
    if (body.action === "log-interview-outcome" && body.candidateId && body.interviewId) {
      const res = await logInterviewOutcomeStore(
        body.candidateId,
        body.interviewId,
        body.outcome || { status: "Passed" }
      );
      if (!res) {
        return NextResponse.json(
          { success: false, message: `Candidate or interview not found for ${body.candidateId}` },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: res });
    }


    // Validation for new candidate intake
    if (!body.fullName || !body.phone) {
      return NextResponse.json(
        { success: false, message: "Candidate Full Name and Phone Number are required" },
        { status: 400 }
      );
    }

    if (!body.requisitionId) {
      return NextResponse.json(
        { success: false, message: "Please link this candidate to an active Job Requisition" },
        { status: 400 }
      );
    }

    const created = await addFmsCandidateStore({
      fullName: body.fullName,
      phone: body.phone,
      email: body.email,
      requisitionId: body.requisitionId,
      position: body.position,
      experience: body.experience,
      source: body.source,
      currentLocation: body.currentLocation,
      preferredLocation: body.preferredLocation,
      currentCompany: body.currentCompany,
      currentSalary: body.currentSalary,
      expectedSalary: body.expectedSalary,
      noticePeriod: body.noticePeriod,
      skills: body.skills,
      resumeLink: body.resumeLink,
      notes: body.notes,
      brand: body.brand,
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    console.error("Error in POST /api/recruitment/candidates-fms:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to process candidate intake" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, updates } = body;

    if (!id || !updates) {
      return NextResponse.json(
        { success: false, message: "id and updates are required" },
        { status: 400 }
      );
    }

    const updated = await updateFmsCandidateStore(id, updates);
    if (!updated) {
      return NextResponse.json(
        { success: false, message: `Candidate ${id} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Error in PATCH /api/recruitment/candidates-fms:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update candidate" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { id, ids } = body;

    if (id) {
      await deleteFmsCandidateStore(id);
    } else if (Array.isArray(ids) && ids.length > 0) {
      for (const singleId of ids) {
        await deleteFmsCandidateStore(singleId);
      }
    } else {
      return NextResponse.json(
        { success: false, message: "id or ids is required" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: "Candidate(s) deleted" });
  } catch (error: any) {
    console.error("Error in DELETE /api/recruitment/candidates-fms:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete candidate" },
      { status: 500 }
    );
  }
}
