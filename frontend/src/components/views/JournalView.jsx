import React, { useState } from 'react';
import { 
  PenSquare, 
  Search, 
  Tag as TagIcon, 
  Trash2, 
  Brain, 
  Filter, 
  CheckCircle2, 
  Sparkles,
  X,
  Lock,
  Users
} from 'lucide-react';
import { MOOD_DEFINITIONS } from '../../data/mockData';
import { createJournalEntry, deleteJournalEntry } from '../../services/journalService';
import SentimentBar from '../SentimentBar';

export default function JournalView({ entries = [], setEntries, onNotification }) {
  const [mood, setMood] = useState("Calm");
  const [text, setText] = useState("");
  const [privacy, setPrivacy] = useState("shared"); // 'private' or 'shared'
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState(["reflection"]);
  const [reflectionText, setReflectionText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMood, setFilterMood] = useState("all");

  const handleAddTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!text.trim()) {
      onNotification("Input Required", "Please enter your thoughts before saving.");
      return;
    }

    const { updatedEntries, createdEntry } = createJournalEntry({
      mood,
      text,
      privacy,
      tags,
      reflection: reflectionText
    });

    setEntries(updatedEntries);
    onNotification(
      "Journal Saved", 
      `Entry saved (${privacy === "shared" ? "Shared with Doctor" : "Private"}).`
    );
    
    // Reset Form
    setText("");
    setTags(["reflection"]);
    setReflectionText("");
  };

  const handleDelete = (id) => {
    const updated = deleteJournalEntry(id);
    setEntries(updated);
    onNotification("Entry Removed", "Journal entry deleted from local storage.");
  };

  const filteredEntries = entries.filter((e) => {
    const matchesSearch = e.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          e.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFilter = filterMood === "all" || e.mood === filterMood;
    return matchesSearch && matchesFilter;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* View Header */}
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800 }}>Journal & Reflection Studio</h1>
        <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
          Log your daily thoughts, practice CBT reframing, and manage clinical visibility permissions.
        </p>
      </div>

      <div className="app-split-2-1">
        {/* Left Column: Journal Composer */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PenSquare size={18} color="var(--color-primary-dark)" />
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Write New Entry</h2>
          </div>

          {/* Privacy Toggle (Private vs Shared with Doctor) */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
              VISIBILITY & CLINICAL PRIVACY
            </label>
            <div className="segmented-control">
              <button
                type="button"
                onClick={() => setPrivacy("shared")}
                className={`segmented-tab ${privacy === "shared" ? "active" : ""}`}
              >
                <Users size={15} />
                <span>Shared with Doctor</span>
              </button>
              <button
                type="button"
                onClick={() => setPrivacy("private")}
                className={`segmented-tab ${privacy === "private" ? "active" : ""}`}
              >
                <Lock size={15} />
                <span>Private Only</span>
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 6 }}>
              {privacy === "shared" 
                ? "✓ Authorized care coordinator can review this entry." 
                : "🔒 Strictly private. Hidden from doctor portal & clinical views."}
            </div>
          </div>

          {/* Mood Selector */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 8 }}>
              SELECT CURRENT MOOD
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 8 }}>
              {MOOD_DEFINITIONS.map((m) => {
                const isSelected = mood === m.label;
                return (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => setMood(m.label)}
                    style={{
                      padding: "10px 6px",
                      borderRadius: "var(--radius-sm)",
                      border: isSelected ? `2px solid ${m.color}` : "1px solid var(--color-border)",
                      background: isSelected ? m.bg : "var(--color-surface)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                      transition: "all 0.15s"
                    }}
                  >
                    <span 
                      style={{ 
                        width: 12, 
                        height: 12, 
                        borderRadius: "50%", 
                        backgroundColor: m.color 
                      }} 
                    />
                    <span style={{ fontSize: 12, fontWeight: 700, color: isSelected ? m.color : "var(--color-text)" }}>
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text Area */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
              JOURNAL THOUGHTS & REFLECTIONS
            </label>
            <textarea
              className="input-field"
              rows={5}
              placeholder="What is on your mind today? Describe your feelings, environment, or triggers..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              style={{ resize: "vertical", height: "auto" }}
            />
            <div style={{ textAlign: "right", fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
              {text.length} / 2000 characters
            </div>
          </div>

          {/* CBT Reflection Prompt */}
          <div style={{ background: "var(--color-bg)", padding: 14, borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--color-primary-dark)", marginBottom: 4 }}>
              <Brain size={15} />
              <span>CBT Reframing Prompt</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 8 }}>
              {MOOD_DEFINITIONS.find(m => m.label === mood)?.cbt}
            </p>
            <input
              type="text"
              className="input-field"
              placeholder="Optional CBT reflection notes..."
              value={reflectionText}
              onChange={(e) => setReflectionText(e.target.value)}
            />
          </div>

          {/* Tags */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
              TAGS (PRESS ENTER TO ADD)
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {tags.map((t) => (
                <span key={t} className="badge badge-primary" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }} onClick={() => handleRemoveTag(t)}>
                  #{t} <X size={12} />
                </span>
              ))}
            </div>
            <div className="input-group">
              <span className="input-icon-left">
                <TagIcon size={16} />
              </span>
              <input
                type="text"
                className="input-field"
                placeholder="Add tag (e.g. work, stress, sleep)..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
            <button 
              type="button" 
              onClick={() => { setText(""); setTags(["reflection"]); }}
              className="btn btn-outline"
            >
              Reset
            </button>
            <button 
              type="button" 
              onClick={handleSave}
              className="btn btn-primary"
            >
              <CheckCircle2 size={16} />
              <span>Save Entry</span>
            </button>
          </div>
        </div>

        {/* Right Column: Search, Filter, & Memory Bank */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Search Memory Bank</h3>
            <div className="input-group">
              <span className="input-icon-left">
                <Search size={16} />
              </span>
              <input
                type="text"
                className="input-field"
                placeholder="Search entries by text or tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
              <button 
                onClick={() => setFilterMood("all")}
                className={`btn btn-sm ${filterMood === "all" ? "btn-primary" : "btn-outline"}`}
              >
                All
              </button>
              {MOOD_DEFINITIONS.map(m => (
                <button
                  key={m.label}
                  onClick={() => setFilterMood(m.label)}
                  className={`btn btn-sm ${filterMood === m.label ? "btn-primary" : "btn-outline"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filtered Entry List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredEntries.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--color-text-muted)" }}>
                <Brain size={32} style={{ margin: "0 auto", opacity: 0.5 }} />
                <p style={{ marginTop: 8, fontSize: 13 }}>No journal entries found matching your filter.</p>
              </div>
            ) : (
              filteredEntries.map((item) => (
                <div key={item.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="badge badge-primary">{item.mood}</span>
                      <span className={`badge ${item.privacy === "shared" ? "badge-primary" : "badge-muted"}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                        {item.privacy === "shared" ? <Users size={11} /> : <Lock size={11} />}
                        {item.privacy === "shared" ? "Shared with Doctor" : "Private"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{item.date}</span>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="btn btn-ghost btn-sm"
                        title="Delete entry"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--color-text)" }}>
                    {item.text}
                  </p>

                  <SentimentBar value={item.sentiment} label="Multimodal Score" />

                  {item.reflection && (
                    <div style={{ background: "var(--color-bg)", padding: 8, borderRadius: 6, fontSize: 11, color: "var(--color-text-muted)" }}>
                      <strong>Reflection:</strong> {item.reflection}
                    </div>
                  )}

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {item.tags.map(t => (
                      <span key={t} className="badge badge-muted" style={{ fontSize: 10 }}>#{t}</span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
