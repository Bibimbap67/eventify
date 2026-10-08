import React, { useState } from "react";
import Icon from "./Icon.js";
import { Modal } from "./admin/ui.js";

export default function FeedbackModal({ registration, onSubmit, onClose }) {
  const [overall, setOverall] = useState(5);
  const [organization, setOrganization] = useState(5);
  const [speaker, setSpeaker] = useState(5);
  const [venue, setVenue] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!comment.trim()) {
      setError("Please write a brief comment or takeaway.");
      return;
    }

    onSubmit({
      overall: Number(overall),
      organization: Number(organization),
      speaker: Number(speaker),
      venue: Number(venue),
      comment: comment.trim(),
    });
  };

  return (
    <Modal title="EVENT FEEDBACK & REVIEW" onClose={onClose} className="feedback-modal">
      {(close) => (
        <>
          <p className="feedback-event-name">
            Rating for: <b>{registration.eventTitle}</b>
          </p>

          <form onSubmit={handleSubmit}>
            <div className="rating-group">
              <label>OVERALL EXPERIENCE (1-5 STARS)</label>
              <div className="star-selector">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    className={`star-btn ${overall >= num ? "star-btn--active" : ""}`}
                    onClick={() => setOverall(num)}
                    aria-label={`${num} star${num > 1 ? "s" : ""}`}
                    aria-pressed={overall >= num}
                  >
                    <Icon name="star" size={20} />
                  </button>
                ))}
                <span className="star-score">{overall} / 5 Stars</span>
              </div>
            </div>

            <div className="rating-grid-sub">
              <div>
                <label>ORGANIZATION</label>
                <select className="input" value={organization} onChange={(e) => setOrganization(e.target.value)}>
                  <option value="5">5 - Excellent</option>
                  <option value="4">4 - Very Good</option>
                  <option value="3">3 - Satisfactory</option>
                  <option value="2">2 - Needs Improvement</option>
                  <option value="1">1 - Poor</option>
                </select>
              </div>

              <div>
                <label>KEYNOTE / SPEAKERS</label>
                <select className="input" value={speaker} onChange={(e) => setSpeaker(e.target.value)}>
                  <option value="5">5 - Inspiring</option>
                  <option value="4">4 - Good</option>
                  <option value="3">3 - Average</option>
                  <option value="2">2 - Fair</option>
                  <option value="1">1 - Disappointing</option>
                </select>
              </div>

              <div>
                <label>VENUE & COMFORT</label>
                <select className="input" value={venue} onChange={(e) => setVenue(e.target.value)}>
                  <option value="5">5 - Great Facilities</option>
                  <option value="4">4 - Comfortable</option>
                  <option value="3">3 - Acceptable</option>
                  <option value="2">2 - Crowded/Noisy</option>
                  <option value="1">1 - Poor</option>
                </select>
              </div>
            </div>

            <div className="rating-group feedback-comment">
              <label>
                WRITTEN TAKEAWAYS & SUGGESTIONS
              </label>
              <textarea
                className="input"
                rows={3}
                placeholder="What did you learn? How can organizers improve future editions?"
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  if (error) setError("");
                }}
              />
            </div>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <div className="action-row">
              <button type="button" className="btn-sm" onClick={close}>
                Cancel
              </button>
              <button type="submit" className="btn-sm btn-sm--yellow">
                Submit Feedback
              </button>
            </div>
          </form>
        </>
      )}
    </Modal>
  );
}
