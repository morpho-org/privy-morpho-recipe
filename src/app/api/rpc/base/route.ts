import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const rpcUrl = process.env.BASE_RPC_URL;
  if (!rpcUrl) {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32603, message: 'RPC not configured' } },
      { status: 500 },
    );
  }

  const body = await req.text();

  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  return new NextResponse(res.body, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
