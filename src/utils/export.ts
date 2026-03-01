// Export utilities for CSV, PDF, and XLSX

// CSV Export
export function exportToCSV(data: any[], filename: string, columns: { key: string; label: string }[]) {
  if (data.length === 0) {
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
