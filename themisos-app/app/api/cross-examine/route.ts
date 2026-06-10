import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 300 // 5 minutes — requires Vercel Pro

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const resp = await fetch("https://app.themisos.ai/cross-examine", {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(290000), // 280 second fetch timeout
    })
    const data = await resp.json()
    return NextResponse.json(data, { status: resp.status })
  } catch (e: any) {
    return NextResponse.json({ error: "Backend unreachable: " + e.message }, { status: 500 })
  }
}