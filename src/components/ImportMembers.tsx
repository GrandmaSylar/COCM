import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Download, Upload, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, invalidateApiCache } from '../services/api';
import * as XLSX from 'xlsx';
import {
  MEMBER_IMPORT_COLUMNS,
  downloadMemberImportTemplate,
  parseMemberImportRow
} from '../utils/export';

// Simple CSV parser that handles quotes
function parseCSVRow(text: string) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

function parseCSV(text: string) {
  // Split by newline taking care of \r
  const rows = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (rows.length === 0) return [];

  const headers = parseCSVRow(rows[0]).map(h => h.trim().replace(/^"|"$/g, ''));
  const dataRows = rows.slice(1);

  return dataRows.map(rowText => {
    const values = parseCSVRow(rowText);
    const rowObj: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowObj[header] = values[index] !== undefined ? values[index] : '';
    });
    return rowObj;
  });
}

export function ImportMembers() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<{ raw: any; data: any; errors: string[] }[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number; failedRows: { row: number; error: string }[] } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResults(null);
    const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();

    if (fileExt === 'csv') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const csvData = parseCSV(text);
          
          const rows = csvData.map(csvRow => {
            const { data, errors } = parseMemberImportRow(csvRow);
            return { raw: csvRow, data, errors };
          });

          setParsedRows(rows);
        } catch (err: any) {
          toast.error('Failed to parse CSV file: ' + err.message);
        }
      };
      reader.readAsText(selectedFile);
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const excelData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { defval: '' });
          
          const rows = excelData.map(excelRow => {
            const stringifiedRow: Record<string, string> = {};
            for (const key in excelRow) {
               stringifiedRow[key.trim()] = String(excelRow[key] ?? '').trim();
            }
          
            const { data, errors } = parseMemberImportRow(stringifiedRow);
            return { raw: excelRow, data, errors };
          });

          setParsedRows(rows);
        } catch (err: any) {
          toast.error('Failed to parse Excel file: ' + err.message);
        }
      };
      reader.readAsBinaryString(selectedFile);
    } else {
      toast.error('Unsupported file format. Please upload a CSV or XLSX file.');
    }
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r.errors.length === 0);
    if (validRows.length === 0) return;

    setImporting(true);
    setResults(null);

    let successCount = 0;
    const failedRows: { row: number; error: string }[] = [];

    // Import sequentially
    for (let i = 0; i < parsedRows.length; i++) {
      const parsedRow = parsedRows[i];
      if (parsedRow.errors.length > 0) continue; // Skip invalid rows

      try {
        await api.members.create(parsedRow.data);
        successCount++;
      } catch (err: any) {
        failedRows.push({ row: i + 1, error: err.message || 'Unknown error' });
      }
    }

    setImporting(false);
    setResults({
      success: successCount,
      failed: failedRows.length,
      failedRows
    });

    if (successCount > 0) {
      invalidateApiCache('/members');
    }

    if (failedRows.length === 0) {
      toast.success(`Successfully imported ${successCount} members.`);
      setFile(null);
      setParsedRows([]);
    } else {
      toast.warning(`Import completed with ${failedRows.length} errors.`);
    }
  };

  const validRowsCount = parsedRows.filter(r => r.errors.length === 0).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Members</CardTitle>
        <CardDescription>
          Bulk import members from a CSV file. Download the template to ensure your data is formatted correctly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-between items-center bg-muted/50 p-4 rounded-lg">
          <div>
            <h3 className="font-medium">1. Prepare your data</h3>
            <p className="text-sm text-muted-foreground mt-1">Download the CSV template and fill it with your data.</p>
          </div>
          <Button onClick={downloadMemberImportTemplate} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Template CSV
          </Button>
        </div>

        <div className="bg-muted/50 p-4 rounded-lg">
          <h3 className="font-medium mb-3">2. Upload CSV / XLSX</h3>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => document.getElementById('file-upload')?.click()}
              className="w-full sm:w-auto"
            >
              <Upload className="w-4 h-4 mr-2" />
              {file ? file.name : "Select File"}
            </Button>
            <input
              id="file-upload"
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </div>

        {parsedRows.length > 0 && !results && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Preview ({parsedRows.length} rows)</h3>
              <Badge variant={validRowsCount > 0 ? 'default' : 'destructive'} className={validRowsCount > 0 ? 'bg-green-100 text-green-800' : ''}>
                {validRowsCount} valid row{validRowsCount !== 1 ? 's' : ''}
              </Badge>
            </div>
            
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground uppercase text-xs">
                  <tr>
                    <th className="px-4 py-2">Row</th>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Zone</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 50).map((row, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-4 py-2">{idx + 1}</td>
                      <td className="px-4 py-2">
                        {row.data.firstName || row.raw['First Name']} {row.data.lastName || row.raw['Last Name']}
                      </td>
                      <td className="px-4 py-2 font-mono">
                        {row.data.zone || row.raw['Zone (A/B/F/K/M/R)']}
                      </td>
                      <td className="px-4 py-2">
                        {row.errors.length === 0 ? (
                          <span className="flex items-center text-green-600">
                            <CheckCircle className="w-4 h-4 mr-1" /> OK
                          </span>
                        ) : (
                          <span className="flex items-center text-red-600">
                            <XCircle className="w-4 h-4 mr-1" /> Err
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-red-600 text-xs max-w-xs truncate" title={row.errors.join(', ')}>
                        {row.errors.length > 0 ? row.errors.join(', ') : '-'}
                      </td>
                    </tr>
                  ))}
                  {parsedRows.length > 50 && (
                    <tr className="border-t">
                      <td colSpan={5} className="px-4 py-2 text-center text-muted-foreground text-xs italic">
                        Showing first 50 rows of {parsedRows.length}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null);
                  setParsedRows([]);
                }}
                disabled={importing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || validRowsCount === 0}
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>Import {validRowsCount} valid rows</>
                )}
              </Button>
            </div>
          </div>
        )}

        {results && (
          <div className="bg-muted p-4 rounded-lg space-y-4">
            <h3 className="font-medium text-lg border-b pb-2">Import Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 p-3 rounded border border-green-200 text-green-800">
                <span className="block text-2xl font-bold">{results.success}</span>
                <span className="text-sm">Successfully Imported</span>
              </div>
              <div className="bg-red-50 p-3 rounded border border-red-200 text-red-800">
                <span className="block text-2xl font-bold">{results.failed}</span>
                <span className="text-sm">Failed to Import</span>
              </div>
            </div>

            {results.failedRows.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2 text-red-700">Failed Rows Details</h4>
                <ul className="text-sm text-red-600 bg-white p-3 rounded border border-red-100 max-h-40 overflow-y-auto space-y-1">
                  {results.failedRows.map((f, i) => (
                    <li key={i}><strong>Row {f.row}:</strong> {f.error}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="pt-2">
              <Button onClick={() => {
                setFile(null);
                setParsedRows([]);
                setResults(null);
              }} variant="outline">Start Over</Button>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
