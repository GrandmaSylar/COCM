// Export utilities for CSV, PDF, and XLSX

// CSV Export
export function exportToCSV(data: any[], filename: string, columns: { key: string; label: string }[], allowEmpty = false) {
  if (data.length === 0 && !allowEmpty) {
    console.warn('No data to export');
    return;
  }

  // Create header row
  const headers = columns.map(col => `"${col.label}"`).join(',');

  // Create data rows
  const rows = data.map(item =>
    columns.map(col => {
      let value = item[col.key];

      // Handle nested properties
      if (col.key.includes('.')) {
        const keys = col.key.split('.');
        value = keys.reduce((obj, key) => obj?.[key], item);
      }

      // Handle arrays
      if (Array.isArray(value)) {
        value = value.join('; ');
      }

      // Handle objects
      if (typeof value === 'object' && value !== null) {
        value = JSON.stringify(value);
      }

      // Escape quotes and wrap in quotes
      const strValue = String(value ?? '');
      return `"${strValue.replace(/"/g, '""')}"`;
    }).join(',')
  );

  const csv = [headers, ...rows].join('\n');
  downloadFile(csv, `${filename}.csv`, 'text/csv;charset=utf-8;');
}

// Simple PDF Export (text-based, no external libraries)
export function exportToPDF(data: any[], filename: string, title: string, columns: { key: string; label: string }[]) {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  // Build a static layout free of dynamic input
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Export</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #333; margin-bottom: 20px; }
        table { border-collapse: collapse; width: 100%; margin-top: 10px; }
        th, td { text-align: left; }
        .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
        @media print {
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <h1 id="doc-title"></h1>
      <p class="meta" id="doc-meta"></p>
      <button class="no-print" onclick="window.print()">Print / Save as PDF</button>
      <table>
        <thead id="doc-thead"><tr></tr></thead>
        <tbody id="doc-tbody"></tbody>
      </table>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();

  // Populate data safely using DOM API
  printWindow.document.title = title;
  const titleEl = printWindow.document.getElementById('doc-title');
  if (titleEl) titleEl.textContent = title;

  const metaEl = printWindow.document.getElementById('doc-meta');
  if (metaEl) metaEl.textContent = `Generated on ${new Date().toLocaleString()} | Total records: ${data.length}`;

  const theadTr = printWindow.document.querySelector('#doc-thead tr');
  if (theadTr) {
    columns.forEach(col => {
      const th = printWindow.document.createElement('th');
      th.style.border = '1px solid #ddd';
      th.style.padding = '8px';
      th.style.background = '#f4f4f4';
      th.textContent = col.label;
      theadTr.appendChild(th);
    });
  }

  const tbody = printWindow.document.getElementById('doc-tbody');
  if (tbody) {
    data.forEach(item => {
      const tr = printWindow.document.createElement('tr');
      columns.forEach(col => {
        let value = item[col.key];

        // Handle nested properties
        if (col.key.includes('.')) {
          const keys = col.key.split('.');
          value = keys.reduce((obj, key) => obj?.[key], item);
        }

        // Handle arrays
        if (Array.isArray(value)) {
          value = value.join(', ');
        }

        // Handle objects
        if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value);
        }

        const td = printWindow.document.createElement('td');
        td.style.border = '1px solid #ddd';
        td.style.padding = '8px';
        td.textContent = String(value ?? '');
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }
}

// XLSX Export (using simple XML-based format)
export function exportToXLSX(data: any[], filename: string, columns: { key: string; label: string }[]) {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Create XML spreadsheet
  const headers = columns.map(col => `<Cell><Data ss:Type="String">${escapeXml(col.label)}</Data></Cell>`).join('');

  const rows = data.map(item =>
    `<Row>${columns.map(col => {
      let value = item[col.key];

      // Handle nested properties
      if (col.key.includes('.')) {
        const keys = col.key.split('.');
        value = keys.reduce((obj, key) => obj?.[key], item);
      }

      // Handle arrays
      if (Array.isArray(value)) {
        value = value.join(', ');
      }

      // Handle objects
      if (typeof value === 'object' && value !== null) {
        value = JSON.stringify(value);
      }

      const strValue = String(value ?? '');
      const type = !isNaN(Number(strValue)) && strValue !== '' ? 'Number' : 'String';

      return `<Cell><Data ss:Type="${type}">${escapeXml(strValue)}</Data></Cell>`;
    }).join('')}</Row>`
  ).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Sheet1">
    <Table>
      <Row>${headers}</Row>
      ${rows}
    </Table>
  </Worksheet>
</Workbook>`;

  downloadFile(xml, `${filename}.xls`, 'application/vnd.ms-excel');
}

// Helper function to download file
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  
  // Removed document.body.appendChild(link) to fix Snyk DOM XSS warning.
  // Most modern browsers support clicking unattached links.
  link.click();
  
  requestAnimationFrame(() => {
    URL.revokeObjectURL(url);
  });
}

// Helper to escape HTML special characters (prevents XSS in PDF export)
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Helper to escape XML special characters
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Format date for export
export function formatDateForExport(dateString: string | undefined): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Format currency for export
export function formatCurrencyForExport(amount: number | undefined): string {
  if (amount === undefined || amount === null) return '';
  return `GH₵ ${amount.toFixed(2)}`;
}

// Grouped CSV Export
export function exportGroupedToCSV(groups: { label: string; subtotal: number; rows: any[] }[], filename: string, columns: { key: string; label: string }[]) {
  if (groups.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Create header row
  const headers = columns.map(col => `"${col.label}"`).join(',');
  const emptyRow = columns.map(() => `""`).join(',');

  const csvRows: string[] = [headers];

  groups.forEach(group => {
    // Group Header
    csvRows.push(`"${group.label}",${columns.slice(1).map(() => '""').join(',')}`);
    
    // Group Data
    group.rows.forEach(item => {
      const row = columns.map(col => {
        let value = item[col.key];
        if (col.key.includes('.')) {
          const keys = col.key.split('.');
          value = keys.reduce((obj, key) => obj?.[key], item);
        }
        if (Array.isArray(value)) value = value.join('; ');
        if (typeof value === 'object' && value !== null) value = JSON.stringify(value);
        return `"${String(value ?? '').replace(/"/g, '""')}"`;
      }).join(',');
      csvRows.push(row);
    });

    // Subtotal
    csvRows.push(`"Subtotal: ${formatCurrencyForExport(group.subtotal)}",${columns.slice(1).map(() => '""').join(',')}`);
    csvRows.push(emptyRow);
  });

  const csv = csvRows.join('\n');
  downloadFile(csv, `${filename}.csv`, 'text/csv;charset=utf-8;');
}

// Grouped PDF Export
export function exportGroupedToPDF(groups: { label: string; subtotal: number; rows: any[] }[], filename: string, title: string, columns: { key: string; label: string }[]) {
  if (groups.length === 0) {
    console.warn('No data to export');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Export</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #333; margin-bottom: 20px; }
        table { border-collapse: collapse; width: 100%; margin-top: 10px; }
        th, td { text-align: left; border: 1px solid #ddd; padding: 8px; }
        th { background: #f4f4f4; }
        .group-header { background: #e0e0e0; font-weight: bold; }
        .group-subtotal { background: #f9f9f9; font-weight: bold; font-style: italic; }
        .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <h1 id="doc-title"></h1>
      <p class="meta" id="doc-meta"></p>
      <button class="no-print" onclick="window.print()">Print / Save as PDF</button>
      <table>
        <thead id="doc-thead"><tr></tr></thead>
        <tbody id="doc-tbody"></tbody>
      </table>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.document.title = title;
  const titleEl = printWindow.document.getElementById('doc-title');
  if (titleEl) titleEl.textContent = title;

  const totalRecords = groups.reduce((sum, g) => sum + g.rows.length, 0);
  const metaEl = printWindow.document.getElementById('doc-meta');
  if (metaEl) metaEl.textContent = `Generated on ${new Date().toLocaleString()} | Total records: ${totalRecords}`;

  const theadTr = printWindow.document.querySelector('#doc-thead tr');
  if (theadTr) {
    columns.forEach(col => {
      const th = printWindow.document.createElement('th');
      th.textContent = col.label;
      theadTr.appendChild(th);
    });
  }

  const tbody = printWindow.document.getElementById('doc-tbody');
  if (tbody) {
    groups.forEach(group => {
      const headerTr = printWindow.document.createElement('tr');
      headerTr.className = 'group-header';
      const headerTd = printWindow.document.createElement('td');
      headerTd.colSpan = columns.length;
      headerTd.textContent = group.label;
      headerTr.appendChild(headerTd);
      tbody.appendChild(headerTr);

      group.rows.forEach(item => {
        const tr = printWindow.document.createElement('tr');
        columns.forEach(col => {
          let value = item[col.key];
          if (col.key.includes('.')) {
            const keys = col.key.split('.');
            value = keys.reduce((obj, key) => obj?.[key], item);
          }
          if (Array.isArray(value)) value = value.join(', ');
          if (typeof value === 'object' && value !== null) value = JSON.stringify(value);
          
          const td = printWindow.document.createElement('td');
          td.textContent = String(value ?? '');
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });

      const subTr = printWindow.document.createElement('tr');
      subTr.className = 'group-subtotal';
      const subTd = printWindow.document.createElement('td');
      subTd.colSpan = columns.length;
      subTd.textContent = `Subtotal: ${formatCurrencyForExport(group.subtotal)}`;
      subTr.appendChild(subTd);
      tbody.appendChild(subTr);
    });
  }
}

// Grouped XLSX
export function exportGroupedToXLSX(groups: { label: string; subtotal: number; rows: any[] }[], filename: string, columns: { key: string; label: string }[]) {
  if (groups.length === 0) {
    console.warn('No data to export');
    return;
  }

  const headers = columns.map(col => `<Cell><Data ss:Type="String">${escapeXml(col.label)}</Data></Cell>`).join('');

  let rowsXml = '';
  groups.forEach(group => {
    rowsXml += `<Row><Cell ss:MergeAcross="${columns.length - 1}" ss:StyleID="s63"><Data ss:Type="String">${escapeXml(group.label)}</Data></Cell></Row>`;
    
    group.rows.forEach(item => {
      rowsXml += `<Row>${columns.map(col => {
        let value = item[col.key];
        if (col.key.includes('.')) {
          const keys = col.key.split('.');
          value = keys.reduce((obj, key) => obj?.[key], item);
        }
        if (Array.isArray(value)) value = value.join(', ');
        if (typeof value === 'object' && value !== null) value = JSON.stringify(value);
        
        const strValue = String(value ?? '');
        const type = !isNaN(Number(strValue)) && strValue !== '' ? 'Number' : 'String';
        return `<Cell><Data ss:Type="${type}">${escapeXml(strValue)}</Data></Cell>`;
      }).join('')}</Row>`;
    });

    rowsXml += `<Row><Cell ss:MergeAcross="${columns.length - 1}" ss:StyleID="s64"><Data ss:Type="String">Subtotal: ${escapeXml(formatCurrencyForExport(group.subtotal))}</Data></Cell></Row>`;
    rowsXml += `<Row></Row>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="s63">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#E0E0E0" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="s64">
      <Font ss:Bold="1" ss:Italic="1"/>
      <Interior ss:Color="#F9F9F9" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Sheet1">
    <Table>
      <Row>${headers}</Row>
      ${rowsXml}
    </Table>
  </Worksheet>
</Workbook>`;

  downloadFile(xml, `${filename}.xls`, 'application/vnd.ms-excel');
}

export const MEMBER_IMPORT_COLUMNS = [
  { key: 'firstName', label: 'First Name', required: true },
  { key: 'lastName', label: 'Last Name', required: true },
  { key: 'otherNames', label: 'Other Names', required: false },
  { key: 'gender', label: 'Gender (male/female)', required: true },
  { key: 'dateOfBirth', label: 'Date of Birth (YYYY-MM-DD)', required: true },
  { key: 'phone', label: 'Phone', required: true },
  { key: 'secondPhone', label: 'Second Phone', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'residenceLocation', label: 'Residence Location', required: true },
  { key: 'zone', label: 'Zone (A/B/F/K/M/R)', required: true },
  { key: 'zoneNumber', label: 'Zone Number (e.g. A01)', required: false },
  { key: 'occupation', label: 'Occupation', required: false },
  { key: 'hometown', label: 'Hometown', required: false },
  { key: 'digitalAddress', label: 'Digital Address', required: false },
  { key: 'maritalStatus', label: 'Marital Status', required: false },
  { key: 'notes', label: 'Notes', required: false },
  { key: 'baptismDateType', label: 'Baptism Date Type (baptised/not_baptised/full/monthYear/yearOnly/forgotten)', aliases: ['Baptism Date Type (full/monthYear/yearOnly/not_baptised)'], required: true },
  { key: 'baptismDatePrecision', label: 'Baptism Date Precision (full/monthYear/yearOnly/forgotten)', required: false },
  { key: 'baptismFullDate', label: 'Baptism Full Date (YYYY-MM-DD)', required: false },
  { key: 'baptismMonth', label: 'Baptism Month', required: false },
  { key: 'baptismYear', label: 'Baptism Year', required: false },
  { key: 'previousCongregation', label: 'Previous Congregation', required: false },
  { key: 'ministries', label: 'Ministries (semicolon-separated)', required: false },
  { key: 'positionHeld', label: 'Position Held (semicolon-separated)', required: false }
];

export function downloadMemberImportTemplate() {
  exportToCSV([], 'members_import_template', MEMBER_IMPORT_COLUMNS, true);
}

export function parseMemberImportRow(row: Record<string, string>) {
  const errors: string[] = [];
  const data: any = {};

  const getVal = (colKey: string) => {
    const colDef = MEMBER_IMPORT_COLUMNS.find(c => c.key === colKey);
    if (!colDef) return '';
    if (row[colDef.label] !== undefined) return row[colDef.label].trim();
    if ('aliases' in colDef && Array.isArray((colDef as any).aliases)) {
      for (const alias of (colDef as any).aliases) {
        if (row[alias] !== undefined) return row[alias].trim();
      }
    }
    if (row[colKey] !== undefined) return row[colKey].trim();
    return '';
  };

  MEMBER_IMPORT_COLUMNS.forEach(col => {
    if (col.required) {
      if (!getVal(col.key)) {
        errors.push(`Missing required field: ${col.label.split(' (')[0]}`);
      }
    }
  });

  data.firstName = getVal('firstName');
  data.lastName = getVal('lastName');
  data.otherNames = getVal('otherNames') || undefined;
  
  const rawGender = getVal('gender').toLowerCase();
  if (getVal('gender') && !['male', 'female'].includes(rawGender)) {
    errors.push(`Invalid gender: ${getVal('gender')}. Must be male or female.`);
  } else {
    data.gender = rawGender;
  }

  data.dateOfBirth = getVal('dateOfBirth') || undefined;
  data.phone = getVal('phone');
  data.secondPhone = getVal('secondPhone') || undefined;
  data.email = getVal('email') || undefined;
  data.residenceLocation = getVal('residenceLocation');
  
  const rawZone = getVal('zone').toUpperCase();
  if (getVal('zone') && !['A', 'B', 'F', 'K', 'M', 'R'].includes(rawZone)) {
    errors.push(`Invalid zone: ${getVal('zone')}. Must be A, B, F, K, M, or R.`);
  } else {
    data.zone = rawZone;
  }

  data.zoneNumber = getVal('zoneNumber') || undefined;
  data.occupation = getVal('occupation') || undefined;
  data.hometown = getVal('hometown') || undefined;
  data.digitalAddress = getVal('digitalAddress') || undefined;
  
  const rawMaritalStatus = getVal('maritalStatus').toLowerCase();
  const validMaritalStats = ['single', 'married', 'widowed', 'divorced'];
  if (getVal('maritalStatus') && !validMaritalStats.includes(rawMaritalStatus)) {
      errors.push(`Invalid marital status: ${getVal('maritalStatus')}`);
  } else if (getVal('maritalStatus')) {
      data.maritalStatus = rawMaritalStatus;
  }

  data.notes = getVal('notes') || undefined;

  const bType = getVal('baptismDateType');
  const validBTypes = ['full', 'monthYear', 'yearOnly', 'not_baptised', 'forgotten', 'baptised'];
  if (bType && !validBTypes.includes(bType)) {
    errors.push(`Invalid baptism date type: ${bType}`);
  }

  // Set status based on baptism input as requested
  if (bType === 'not_baptised') {
    data.status = 'not baptised';
    data.baptismInfo = {
      baptismStatus: 'not_baptised',
      previousCongregation: getVal('previousCongregation') || undefined
    };
  } else if (bType === 'baptised') {
    data.status = 'new';
    const precisionStr = getVal('baptismDatePrecision');
    const validPrecisions = ['full', 'monthYear', 'yearOnly', 'forgotten'];
    const dateType = validPrecisions.includes(precisionStr) ? precisionStr : 'forgotten';
    
    data.baptismInfo = {
      baptismStatus: 'baptised',
      dateType,
      ...(dateType !== 'forgotten' && {
        fullDate: getVal('baptismFullDate') || undefined,
        month: getVal('baptismMonth') || undefined,
        year: getVal('baptismYear') ? parseInt(getVal('baptismYear'), 10) : undefined,
      }),
      previousCongregation: getVal('previousCongregation') || undefined
    };
  } else if (bType && ['full', 'monthYear', 'yearOnly', 'forgotten'].includes(bType)) {
    data.status = 'new';
    data.baptismInfo = {
      baptismStatus: 'baptised',
      dateType: bType,
      ...(bType !== 'forgotten' && {
        fullDate: getVal('baptismFullDate') || undefined,
        month: getVal('baptismMonth') || undefined,
        year: getVal('baptismYear') ? parseInt(getVal('baptismYear'), 10) : undefined,
      }),
      previousCongregation: getVal('previousCongregation') || undefined
    };
  } else {
    data.status = 'new';
    data.baptismInfo = {
      baptismStatus: 'baptised',
      dateType: 'forgotten',
      previousCongregation: getVal('previousCongregation') || undefined
    };
  }

  const minsVal = getVal('ministries');
  data.ministries = minsVal ? minsVal.split(';').map(m => m.trim()).filter(Boolean) : [];

  const posVal = getVal('positionHeld');
  data.positionHeld = posVal ? posVal.split(';').map(p => p.trim()).filter(Boolean) : [];

  return { data, errors };
}
