import React from 'react';
import { EmptyState } from './EmptyState';
import { FileText } from 'lucide-react';

export function DataTable({ 
  columns = [], 
  data = [], 
  emptyTitle = "No records found", 
  emptyDescription = "No items matching your criteria.",
  renderMobileCard 
}) {
  if (data.length === 0) {
    return <EmptyState icon={FileText} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="card desktop-table-container" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--color-bg)", borderBottom: "1px solid var(--color-border)" }}>
              {columns.map((col, idx) => (
                <th key={idx} style={{ padding: "12px 16px", fontWeight: 700, color: "var(--color-text-muted)" }}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rIdx) => (
              <tr key={row.id || rIdx} style={{ borderBottom: "1px solid var(--color-border)" }}>
                {columns.map((col, cIdx) => (
                  <td key={cIdx} style={{ padding: "12px 16px" }}>
                    {col.cell ? col.cell(row) : row[col.accessor]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View */}
      <div className="mobile-card-list" style={{ display: "none", flexDirection: "column", gap: 10 }}>
        {data.map((row, idx) => (
          <div key={row.id || idx} className="card" style={{ padding: 14 }}>
            {renderMobileCard ? renderMobileCard(row) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {columns.map((col, cIdx) => (
                  <div key={cIdx} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: "var(--color-text-muted)" }}>{col.header}:</span>
                    <span>{col.cell ? col.cell(row) : row[col.accessor]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .desktop-table-container {
            display: none !important;
          }
          .mobile-card-list {
            display: flex !important;
          }
        }
      `}</style>
    </>
  );
}
