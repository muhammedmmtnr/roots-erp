import { errorResponse, json } from "@/lib/api";
import { isGoogleSheetsConfigured, syncErpExportToGoogleSheets } from "@/lib/google-sheets";

export async function POST() {
  try {
    if (!isGoogleSheetsConfigured()) {
      return json({
        error: "Google Sheets is not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_SHEETS_SPREADSHEET_ID.",
      }, 503);
    }
    const result = await syncErpExportToGoogleSheets();
    return json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
