import { formatCurrencyForExport } from './export';

interface ReportData {
  attendanceData: any[];
  givingData: any[];
  membershipData: any[];
  membersByStatus: any[];
  membersByZone: any[];
  givingByType: any[];
  attendanceDenominations: any[];
  membersByGender: any[];
  membersByMaritalStatus: any[];
  membersByMinistry: any[];
  membersByAge: any[];
  visitorConversion: any[];
  visitorsByStatus: any[];
  visitorConversionRate: number;
  totalExpenses: number;
  expenseRecords: any[];
  summary: {
    totalMembers: number;
    avgAttendance: number;
    totalGiving: number;
    growthRate: number;
    attendanceRate: number;
    memberRetention: number;
    servicesHeld: number;
    newMembersThisMonth: number;
    monthlyGiving: number;
    monthlyAvgAttendance: number;
    avgGivingPerService: number;
    mostActiveZone: string;
    activeMembers: number;
    totalVisitors: number;
    mainTotalMembers?: number;
    childrenTotalMembers?: number;
    mainAvgAttendance?: number;
    childrenAvgAttendance?: number;
    mainTotalGiving?: number;
    childrenTotalGiving?: number;
    mainTotalVisitors?: number;
    childrenTotalVisitors?: number;
  };
}

export function exportFullDbReportToPDF(
  data: ReportData,
  startDate: string,
  endDate: string,
  scope: string
) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const dateLabel = startDate && endDate 
    ? `${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`
    : 'Full Database History';

  const scopeLabel = scope === 'main' 
    ? 'Main Data Only' 
    : scope === 'children' 
      ? "Children's Ministry Only" 
      : 'All Departments (Merged)';

  const netGiving = (data.summary.totalGiving || 0) - data.totalExpenses;

  // Build rows for tables
  const statusRows = data.membersByStatus.map(s => `
    <tr>
      <td class="capitalize">${s.status.replace('-', ' ')}</td>
      <td class="text-right font-medium">${s.count}</td>
      <td class="text-right text-muted">${data.summary.totalMembers ? Math.round((s.count / data.summary.totalMembers) * 100) : 0}%</td>
    </tr>
  `).join('');

  const zoneRows = data.membersByZone.map(z => `
    <tr>
      <td>Zone ${z.zone}</td>
      <td class="text-right font-medium">${z.count}</td>
      <td class="text-right text-muted">${data.summary.totalMembers ? Math.round((z.count / data.summary.totalMembers) * 100) : 0}%</td>
    </tr>
  `).join('');

  const genderRows = data.membersByGender.map(g => `
    <tr>
      <td class="capitalize">${g.gender}</td>
      <td class="text-right font-medium">${g.count}</td>
      <td class="text-right text-muted">${data.summary.totalMembers ? Math.round((g.count / data.summary.totalMembers) * 100) : 0}%</td>
    </tr>
  `).join('');

  const maritalRows = data.membersByMaritalStatus.map(m => `
    <tr>
      <td class="capitalize">${m.status}</td>
      <td class="text-right font-medium">${m.count}</td>
      <td class="text-right text-muted">${data.summary.totalMembers ? Math.round((m.count / data.summary.totalMembers) * 100) : 0}%</td>
    </tr>
  `).join('');

  const ministryRows = data.membersByMinistry.map(m => `
    <tr>
      <td>${m.ministry}</td>
      <td class="text-right font-medium">${m.count}</td>
    </tr>
  `).join('');

  const ageRows = data.membersByAge.map(a => `
    <tr>
      <td>${a.group}</td>
      <td class="text-right font-medium">${a.count}</td>
    </tr>
  `).join('');

  const givingTypeRows = data.givingByType.map(g => `
    <tr>
      <td>${g.type}</td>
      <td class="text-right font-medium">${formatCurrencyForExport(g.amount)}</td>
      <td class="text-right text-muted">${data.summary.totalGiving ? Math.round((g.amount / data.summary.totalGiving) * 100) : 0}%</td>
    </tr>
  `).join('');

  // Expenses breakdown by service type
  const expensesByServiceTypeMap: Record<string, number> = {};
  data.expenseRecords.forEach((exp: any) => {
    const stype = exp.serviceType || 'Other';
    expensesByServiceTypeMap[stype] = (expensesByServiceTypeMap[stype] || 0) + (exp.amount || 0);
  });
  const expenseTypeRows = Object.entries(expensesByServiceTypeMap)
    .sort((a, b) => b[1] - a[1])
    .map(([type, amount]) => `
      <tr>
        <td>${type}</td>
        <td class="text-right font-medium">${formatCurrencyForExport(amount)}</td>
        <td class="text-right text-muted">${data.totalExpenses ? Math.round((amount / data.totalExpenses) * 100) : 0}%</td>
      </tr>
    `).join('');

  const visitorStatusRows = data.visitorsByStatus.map(v => `
    <tr>
      <td class="capitalize">${v.status}</td>
      <td class="text-right font-medium">${v.count}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Church Analytics Executive Report</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        body {
          font-family: 'Inter', sans-serif;
          color: #1e293b;
          background: #ffffff;
          margin: 0;
          padding: 40px;
          line-height: 1.5;
        }

        .header-container {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }

        .logo-title-group {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .logo-placeholder {
          width: 50px;
          height: 50px;
          background: #1b4d3e;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 20px;
        }

        h1 {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          letter-spacing: -0.025em;
        }

        .subtitle {
          font-size: 14px;
          color: #64748b;
          margin: 5px 0 0 0;
        }

        .meta-info {
          text-align: right;
          font-size: 13px;
          color: #64748b;
        }

        .meta-info strong {
          color: #0f172a;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-bottom: 30px;
        }

        .kpi-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
          background: #f8fafc;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }

        .kpi-card.highlight {
          border-color: #1b4d3e;
          background: #f0f7f4;
        }

        .kpi-label {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .kpi-value {
          font-size: 28px;
          font-weight: 700;
          color: #0f172a;
          margin-top: 5px;
        }

        .kpi-card.highlight .kpi-value {
          color: #1b4d3e;
        }

        .kpi-sub {
          font-size: 12px;
          color: #64748b;
          margin-top: 5px;
        }

        .section-title {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 8px;
          margin-top: 40px;
          margin-bottom: 15px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .grid-2-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 13px;
        }

        th {
          background: #f1f5f9;
          color: #475569;
          font-weight: 600;
          text-align: left;
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
        }

        td {
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          color: #334155;
        }

        tr:nth-child(even) td {
          background: #f8fafc;
        }

        .text-right {
          text-align: right;
        }

        .text-muted {
          color: #64748b;
        }

        .font-medium {
          font-weight: 500;
        }

        .no-print-btn {
          background: #1b4d3e;
          color: white;
          border: none;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
          margin-bottom: 20px;
          transition: background 0.2s;
        }

        .no-print-btn:hover {
          background: #143a2e;
        }

        @media print {
          .no-print {
            display: none;
          }
          body {
            padding: 0;
          }
          .kpi-card {
            background: #ffffff !important;
            border: 1px solid #cbd5e1 !important;
          }
          .kpi-card.highlight {
            background: #f0f7f4 !important;
            border-color: #1b4d3e !important;
          }
          .page-break {
            page-break-before: always;
          }
        }
      </style>
    </head>
    <body>
      <div class="no-print">
        <button class="no-print-btn" onclick="window.print()">Print / Save as PDF</button>
      </div>

      <div class="header-container">
        <div class="logo-title-group">
          <img src="${window.location.origin}/newlogo.png" alt="Church Logo" style="width: 50px; height: 50px; object-fit: contain;" />
          <div>
            <h1>Mataheko Church of Christ</h1>
            <p class="subtitle">Executive Analytics & Statistical Report</p>
          </div>
        </div>
        <div class="meta-info">
          <div>Report Range: <strong>${dateLabel}</strong></div>
          <div>Department Scope: <strong>${scopeLabel}</strong></div>
          <div>Generated: <strong>${new Date().toLocaleString()}</strong></div>
        </div>
      </div>

      <!-- KPI Summary -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Membership Overview</div>
          <div class="kpi-value">${data.summary.totalMembers}</div>
          <div class="kpi-sub">${data.summary.activeMembers} active members registered</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Average Attendance</div>
          <div class="kpi-value">${data.summary.avgAttendance}</div>
          <div class="kpi-sub">Across ${data.summary.servicesHeld} services held</div>
        </div>
        <div class="kpi-card highlight">
          <div class="kpi-label">Net Stewardship</div>
          <div class="kpi-value">${formatCurrencyForExport(netGiving)}</div>
          <div class="kpi-sub">${formatCurrencyForExport(data.summary.totalGiving)} giving vs ${formatCurrencyForExport(data.totalExpenses)} expenses</div>
        </div>
      </div>

      <!-- Section: Demographics -->
      <div class="section-title">1. Congregational Demographics</div>
      <div class="grid-2-col">
        <div>
          <h3>Gender Distribution</h3>
          <table>
            <thead>
              <tr>
                <th>Gender</th>
                <th class="text-right">Count</th>
                <th class="text-right">Percentage</th>
              </tr>
            </thead>
            <tbody>
              ${genderRows || '<tr><td colspan="3" class="text-muted">No data available</td></tr>'}
            </tbody>
          </table>
        </div>

        <div>
          <h3>Marital Status</h3>
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th class="text-right">Count</th>
                <th class="text-right">Percentage</th>
              </tr>
            </thead>
            <tbody>
              ${maritalRows || '<tr><td colspan="3" class="text-muted">No data available</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid-2-col">
        <div>
          <h3>Age Bracket Groupings</h3>
          <table>
            <thead>
              <tr>
                <th>Age Group</th>
                <th class="text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              ${ageRows || '<tr><td colspan="2" class="text-muted">No data available</td></tr>'}
            </tbody>
          </table>
        </div>
        
        <div>
          <h3>Member Status</h3>
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th class="text-right">Count</th>
                <th class="text-right">Percentage</th>
              </tr>
            </thead>
            <tbody>
              ${statusRows || '<tr><td colspan="3" class="text-muted">No data available</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="page-break"></div>

      <!-- Section: Financial Stewardship -->
      <div class="section-title">2. Financial Stewardship & Expenditure</div>
      <div class="grid-2-col">
        <div>
          <h3>Revenue by Giving Type</h3>
          <table>
            <thead>
              <tr>
                <th>Giving Type</th>
                <th class="text-right">Total Amount</th>
                <th class="text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              ${givingTypeRows || '<tr><td colspan="3" class="text-muted">No giving data recorded</td></tr>'}
            </tbody>
          </table>
        </div>

        <div>
          <h3>Expenditure by Service Type</h3>
          <table>
            <thead>
              <tr>
                <th>Service Type</th>
                <th class="text-right">Total Expenses</th>
                <th class="text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              ${expenseTypeRows || '<tr><td colspan="3" class="text-muted">No expenses recorded</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Section: Structural Breakdowns -->
      <div class="section-title">3. Ministry & Structural Breakdowns</div>
      <div class="grid-2-col">
        <div>
          <h3>Zone-by-Zone Members</h3>
          <table>
            <thead>
              <tr>
                <th>Zone</th>
                <th class="text-right">Count</th>
                <th class="text-right">Percentage</th>
              </tr>
            </thead>
            <tbody>
              ${zoneRows || '<tr><td colspan="3" class="text-muted">No data available</td></tr>'}
            </tbody>
          </table>
        </div>

        <div>
          <h3>Ministry Active Enrollment</h3>
          <table>
            <thead>
              <tr>
                <th>Ministry</th>
                <th class="text-right">Enrollment</th>
              </tr>
            </thead>
            <tbody>
              ${ministryRows || '<tr><td colspan="2" class="text-muted">No data available</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Section: Visitor & Conversion Analytics -->
      <div class="section-title">4. Visitor Conversion & Follow-up</div>
      <div class="grid-2-col">
        <div class="kpi-card highlight" style="display: flex; flex-direction: column; justify-content: center; height: 120px; margin-bottom: 20px;">
          <div class="kpi-label">Conversion Rate</div>
          <div class="kpi-value">${data.visitorConversionRate}%</div>
          <div class="kpi-sub">${data.summary.totalVisitors || 0} visitors welcomed in range</div>
        </div>

        <div>
          <h3>Follow-up Status</h3>
          <table>
            <thead>
              <tr>
                <th>Follow-up Status</th>
                <th class="text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              ${visitorStatusRows || '<tr><td colspan="2" class="text-muted">No data available</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8;">
        This document contains confidential congregational analytics and is for official use only.
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
