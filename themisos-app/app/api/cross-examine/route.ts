import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const resp = await fetch("https://app.themisos.ai/cross-examine", {
      method: "POST",
      body: formData,
    })
    const data = await resp.json()
    return NextResponse.json(data, { status: resp.status })
  } catch (e: any) {
    return NextResponse.json({ error: "Backend unreachable: " + e.message }, { status: 500 })
  }
}
