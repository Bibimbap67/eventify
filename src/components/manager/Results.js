import React from "react";
import { Pagination, downloadCsv, usePaged } from "../admin/parts.js";
import Icon from "../Icon.js";
import FeedbackSummary, { Stars } from "../FeedbackSummary.js";
import { EmptyState, Metric, PersonCell, SectionHeading, StatusBadge, countRegistrations, getAttendance, plural } from "../ui.js";
import { summarizeFeedback } from "../../data/feedback.js";

// After the event: what participants said, and the numbers for one event.

const FEEDBACK_PAGE = 10;

export function FeedbackPanel({ feedback, eyebrow = "Participant feedback", title = "What participants said" }) {
  const summary = summarizeFeedback(feedback);
  // Low ratings first: they are what to fix before the next event.
  const ordered = [...summary.concerns, ...feedback.filter((item) => !summary.concerns.includes(item))];
  // 10 comments at a time; the summary above still counts them all.
  const { page, setPage, shown } = usePaged(ordered, FEEDBACK_PAGE);
  return (
    <section className="manager-panel">
      <SectionHeading eyebrow={eyebrow} title={title} detail="Use these responses to improve event execution and future programming." />
      <FeedbackSummary summary={summary} />
      {feedback.length ? (
        <div className="manager-feedback-list">
          {shown.map((item) => (
            <article key={item.id} className={summary.concerns.includes(item) ? "is-concern" : undefined}>
              <div>
                <PersonCell name={item.participant} detail={item.date} />
                <span className="manager-feedback-rating">
                  {summary.concerns.includes(item) && <span className="fb-flag">Concern</span>}
                  <Stars value={Number(item.rating) || 0} />
                </span>
              </div>
              <p>{item.comment}</p>
              <small>
                <span>Organization {item.organizationRating}/5</span>
                <span>Speaker {item.speakerRating}/5</span>
                <span>Venue {item.venueRating}/5</span>
              </small>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon="message" title="No feedback yet">Feedback is available after participants attend the event.</EmptyState>
      )}
      <Pagination page={page} limit={FEEDBACK_PAGE} total={ordered.length} noun="comment" onPage={setPage} />
    </section>
  );
}

export function ReportPanel({ event, registrations, feedback, sessions, eyebrow = "Event report", title = "Results snapshot" }) {
  const count = countRegistrations(event.id, registrations);
  const attendance = getAttendance(event.id, registrations);
  const absenceCount = attendance.confirmed.length - attendance.checkedIn.length;
  const { average } = summarizeFeedback(feedback);

  function exportCsv() {
    downloadCsv(
      `${event.id}-report.csv`,
      ["Event", "Registration count", "Capacity", "Checked in", "Absences", "Attendance %", "Feedback average", "Status"],
      [[event.title, count, event.capacity, attendance.checkedIn.length, absenceCount, attendance.percentage, average?.toFixed(1) || "", event.status]]
    );
  }

  return (
    <section className="manager-panel">
      <SectionHeading
        eyebrow={eyebrow}
        title={title}
        detail="Counts are calculated from this assigned event's registrations and feedback."
        action={<button type="button" className="manager-button" onClick={exportCsv}><Icon name="download" size={16} /> Export CSV</button>}
      />
      <div className="manager-report-grid">
        <Metric icon="ticket" tone="yellow" label="Registrations" value={`${count} / ${event.capacity}`} note={`${Math.round(count / event.capacity * 100)}% of capacity`} />
        <Metric icon="user-check" tone="mint" label="Checked in" value={attendance.checkedIn.length} note={`${attendance.percentage}% of confirmed participants`} />
        <Metric icon="alert-circle" tone="coral" label="Absences" value={absenceCount} note="Confirmed but not checked in" />
        <Metric icon="star" tone="violet" label="Feedback" value={average === null ? "—" : average.toFixed(1)} note={plural(feedback.length, "response")} />
      </div>
      <dl className="manager-definition-list manager-definition-list--report">
        <div><dt>Event status</dt><dd><StatusBadge value={event.status} /></dd></div>
        <div><dt>Completed</dt><dd>{event.completedAt || "Not completed"}</dd></div>
        <div><dt>Sessions on programme</dt><dd>{sessions.length}</dd></div>
        <div><dt>Attendance summary</dt><dd>{attendance.checkedIn.length} attended · {absenceCount} absent</dd></div>
      </dl>
    </section>
  );
}
