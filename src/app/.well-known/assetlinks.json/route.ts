import { NextResponse } from 'next/server';

const assetlinks = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'in.agricartfpc.erp.twa',
      sha256_cert_fingerprints: [
        '1B:A9:5C:FD:DE:97:B6:17:28:BC:95:A6:19:C9:0F:18:8F:BD:75:37:6F:02:5D:9C:29:27:AF:9D:35:14:8F:A0',
      ],
    },
  },
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.agricarterp.app',
      sha256_cert_fingerprints: [
        '8B:C3:6C:62:6F:DC:28:A7:4A:95:E6:A6:C0:8E:17:AB:F8:84:CD:EE:CC:FD:79:45:57:4C:73:75:78:0F:D8:BF',
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
