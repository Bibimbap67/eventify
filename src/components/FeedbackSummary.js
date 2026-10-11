import React from "react";
import Icon from "./Icon.js";

export function Stars({ value, size = 16 }) {
  return (
    <span className="fb-stars" role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= Math.round(value) ? "is-on" : ""}><Icon name="star" size={size} /></span>
      ))}
    </span>
  );
}

// Many responses as one card: the average, a one-line summary, how many were positive, neutral
// or negative, and how each part of the event scored. `summary` comes from summarizeFeedback().
export default function FeedbackSummary({ summary }) {
  const { count, average, aspects, split, headline } = summary;
  const share = (n) => `${count ? (n / count) * 100 : 0}%`;
  return (
    <div className="fb-summary">
      <div className="fb-summary__score">
        <strong>{count ? average.toFixed(1) : "—"}<small> / 5</small></strong>
        <Stars value={average || 0} />
        <span>{count} {count === 1 ? "response" : "responses"}</span>
      </div>
      <div className="fb-summary__body">
        <p className="fb-summary__headline">{headline}</p>
        {count > 0 && (
          <>
            <div className="fb-split" role="img" aria-label={`${split.positive} positive, ${split.neutral} neutral, ${split.negative} negative`}>
              {split.positive > 0 && <span data-tone="success" style={{ width: share(split.positive) }} />}
              {split.neutral > 0 && <span data-tone="warning" style={{ width: share(split.neutral) }} />}
              {split.negative > 0 && <span data-tone="error" style={{ width: share(split.negative) }} />}
            </div>
            <ul className="fb-split__legend">
              <li data-tone="success">Positive (4–5★) <b>{split.positive}</b></li>
              <li data-tone="warning">Neutral (3★) <b>{split.neutral}</b></li>
              <li data-tone="error">Negative (1–2★) <b>{split.negative}</b></li>
            </ul>
            {aspects.length > 0 && (
              <dl className="fb-aspects">
                {aspects.map((aspect) => (
                  <div key={aspect.key}>
                    <dt>{aspect.label}</dt>
                    <dd>
                      <span className="fb-aspects__bar"><span style={{ width: `${(aspect.average / 5) * 100}%` }} /></span>
                      <b>{aspect.average.toFixed(1)}</b>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        )}
      </div>
    </div>
  );
}
