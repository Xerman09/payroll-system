import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { trendData } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ error: "API key is not configured" }, { status: 400 });
    }

    if (!trendData || !Array.isArray(trendData) || trendData.length === 0) {
      return NextResponse.json({ ai_insights: "No payroll data available for analysis." });
    }

    // Optimize data size to make AI processing faster but keep enough for a detailed report
    const optimizedData = trendData.slice(-60).map((r: any) => ({
      dept: r.department_name,
      cutoff: r.cutoff_end,
      net: r.total_net,
    }));

    const prompt = `Here is the payroll trend data (dept=Department, cutoff=Cutoff Date, net=Net Pay):
${JSON.stringify(optimizedData)}

Please act as a financial analyst and provide a comprehensive, detailed executive summary of the payroll expenditure trends across departments. 
Highlight any significant increases, decreases, anomalies, or cost-saving opportunities. 
Structure the report professionally with markdown headers (e.g., Executive Summary, Departmental Analysis, Key Findings). 
CRITICAL: All currency values MUST be formatted in Philippine Peso (PHP) using the '₱' symbol.`;

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    
    const geminiData = await geminiRes.json();
    
    if (geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
      return NextResponse.json({ ai_insights: geminiData.candidates[0].content.parts[0].text });
    } else if (geminiData.error) {
      console.error("Gemini API Error Response:", geminiData.error);
      return NextResponse.json({ error: geminiData.error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Unknown error from Gemini" }, { status: 500 });

  } catch (error) {
    console.error("Payroll AI Report API error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI insights", details: String(error) },
      { status: 500 }
    );
  }
}
