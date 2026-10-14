import { NextResponse } from 'next/server';

const assetlinks = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'in.agricartfpc.erp.twa',
      sha256_cert_fingerprints: [
        'B9:58:DC:BD:5C:C3:A7:E5:54:D1:61:6A:E2:01:31:A8:D7:1F:6A:86:C2:4D:7E:77:D3:B4:5E:AC:6E:4C:19:3E',
      ],
    },
  },
];

export async function GET() {
  return new NextResponse(JSON.stringify(assetlinks, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
