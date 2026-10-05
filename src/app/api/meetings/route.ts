import { NextRequest, NextResponse } from "next/server";
import { getAllMeetings, addMeetingRecord, getEmployeeByKey } from "@/lib/store";
import { MeetingRecord } from "@/types";
import { uploadHrAttachment } from "@/lib/google-drive";

import { errorStatus } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const employeeKey = searchParams.get("employeeKey");

    let meetings = await getAllMeetings();
    if (status && status !== "All") {
      meetings = meetings.filter((m) => m.recordStatus === status);
    }
    if (employeeKey) {
      meetings = meetings.filter((m) => m.employeeKey === employeeKey);
    }

    return NextResponse.json({ success: true, data: meetings });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch meetings" },
      { status: errorStatus(error) }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const idempotencyKey = req.headers.get("Idempotency-Key");
    const payload = await req.json();

    if (!payload.employeeKey || !payload.discussionNotes || !payload.recordedBy) {
      return NextResponse.json(
        { success: false, error: "employeeKey, discussionNotes, and recordedBy are required" },
        { status: 400 }
      );
    }

    const employee = await getEmployeeByKey(payload.employeeKey);
    if (!employee) {
      return NextResponse.json(
        { success: false, error: "Selected employee not found" },
        { status: 404 }
      );
    }

    const meetingId =
      payload.meetingId ||
      `MTG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const uploaded = payload.attachment
      ? await uploadHrAttachment(payload.attachment, employee.fullName, employee.employeeKey, meetingId)
      : null;

    const newMeeting = await addMeetingRecord({
      meetingId,
      employeeKey: employee.employeeKey,
      employeeId: employee.employeeId,
      employeeName: employee.fullName,
      milestone: payload.milestone || "",
      meetingType: payload.meetingType || "General",
      scheduledDate: payload.scheduledDate || "",
      meetingDate: payload.meetingDate || "",
      discussionNotes: payload.discussionNotes,
      warningGiven: payload.warningGiven === "Yes" ? "Yes" : "No",
      actionTaken: payload.actionTaken || "",
      nextFollowUpDate: payload.nextFollowUpDate || "",
      attachmentLink: uploaded?.driveLink || payload.attachmentLink || "",
      recordedBy: payload.recordedBy,
      recordStatus: payload.recordStatus || "Open",
    });

    return NextResponse.json({
      success: true,
      data: newMeeting,
      idempotencyKey,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to save meeting" },
      { status: errorStatus(error) }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = await req.json();
    const { meetingId, recordStatus, performedBy } = payload;

    if (!meetingId || !recordStatus) {
      return NextResponse.json(
        { success: false, error: "meetingId and recordStatus are required" },
        { status: 400 }
      );
    }

    const { updateMeetingStatus } = await import("@/lib/store");
    const updated = await updateMeetingStatus(
      meetingId,
      recordStatus,
      performedBy || "HR Command User"
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Meeting record not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update meeting status" },
      { status: errorStatus(error) }
    );
  }
}
